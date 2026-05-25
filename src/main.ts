// Must run before any SDK imports to patch Electron/Node.js realm incompatibility
import { patchSetMaxListenersForElectron } from './utils/electronCompat';
patchSetMaxListenersForElectron();

import './providers';

import type { Editor } from 'obsidian';
import { MarkdownView, Notice, Plugin } from 'obsidian';

import { ConversationService } from './app/services/ConversationService';
import { EnvironmentService } from './app/services/EnvironmentService';
import { ViewService } from './app/services/ViewService';
import { DEFAULT_CLAUDIAN_SETTINGS } from './app/settings/defaultSettings';
import { SharedStorageService } from './app/storage/SharedStorageService';
import type { SharedAppStorage } from './core/bootstrap/storage';
import { ProviderRegistry } from './core/providers/ProviderRegistry';
import { ProviderSettingsCoordinator } from './core/providers/ProviderSettingsCoordinator';
import { ProviderWorkspaceRegistry } from './core/providers/ProviderWorkspaceRegistry';
import type { ProviderId } from './core/providers/types';
import { DEFAULT_CHAT_PROVIDER_ID } from './core/providers/types';
import type {
  ClaudianSettings,
  Conversation,
  ConversationMeta,
} from './core/types';
import {
  VIEW_TYPE_CLAUDIAN,
} from './core/types';
import type { EnvironmentScope } from './core/types/settings';
import { ClaudianView } from './features/chat/ClaudianView';
import { type InlineEditContext, InlineEditModal } from './features/inline-edit/ui/InlineEditModal';
import { ClaudianSettingTab } from './features/settings/ClaudianSettings';
import { setLocale } from './i18n/i18n';
import type { Locale } from './i18n/types';
import { buildCursorContext } from './utils/editor';

export default class ClaudianPlugin extends Plugin {
  settings!: ClaudianSettings;
  storage!: SharedAppStorage;
  private conversations: Conversation[] = [];
  private conversationService!: ConversationService;
  private environmentService!: EnvironmentService;
  private viewService!: ViewService;
  private startupClaudeAuthCheckScheduled = false;

  private initializeServices(): void {
    this.viewService = new ViewService(this.app);
    this.conversationService = new ConversationService({
      app: this.app,
      storage: this.storage,
      getAllViews: () => this.viewService.getAllViews(),
    });
    this.environmentService = new EnvironmentService({
      settings: this.settings as unknown as Record<string, unknown>,
      conversations: this.conversations,
      saveSettings: () => this.saveSettings(),
      getView: () => this.viewService.getView(),
      getAllViews: () => this.viewService.getAllViews(),
      persistConversation: async (conversation) => {
        await this.storage.sessions.saveMetadata(
          this.storage.sessions.toSessionMetadata(conversation)
        );
      },
    });
  }

  async onload() {
    try {
      await this.loadSettings();
    } catch (error) {
      console.error('[Claudian] Failed to load settings; falling back to defaults.', error);
      this.storage = new SharedStorageService(this);
      this.settings = { ...DEFAULT_CLAUDIAN_SETTINGS } as ClaudianSettings;
      this.conversations = [];
      this.initializeServices();
      new Notice('Claudian recovered with default settings after a startup error.');
    }

    try {
      await ProviderWorkspaceRegistry.initializeAll(this);
    } catch (error) {
      console.error('[Claudian] Provider workspace initialization failed.', error);
    }

    try {
      this.registerView(
        VIEW_TYPE_CLAUDIAN,
        (leaf) => new ClaudianView(leaf, this)
      );
    } catch (error) {
      console.error('[Claudian] Failed to register view.', error);
    }

    try {
      this.addRibbonIcon('bot', 'Open Claudian', () => {
        this.activateView();
      });

      this.addCommand({
        id: 'open-view',
        name: 'Open chat view',
        callback: () => {
          this.activateView();
        },
      });

      this.addCommand({
        id: 'inline-edit',
        name: 'Inline edit',
        editorCallback: async (editor: Editor, ctx) => {
          const view = ctx instanceof MarkdownView
            ? ctx
            : this.app.workspace.getActiveViewOfType(MarkdownView);
          if (!view) {
            new Notice('Inline edit unavailable: could not access the active markdown view.');
            return;
          }

          const selectedText = editor.getSelection();
          const notePath = view.file?.path || 'unknown';

          let editContext: InlineEditContext;
          if (selectedText.trim()) {
            editContext = { mode: 'selection', selectedText };
          } else {
            const cursor = editor.getCursor();
            const cursorContext = buildCursorContext(
              (line) => editor.getLine(line),
              editor.lineCount(),
              cursor.line,
              cursor.ch
            );
            editContext = { mode: 'cursor', cursorContext };
          }

          const modal = new InlineEditModal(
            this.app,
            this,
            editor,
            view,
            editContext,
            notePath,
            () => this.getView()?.getActiveTab()?.ui.externalContextSelector?.getExternalContexts() ?? []
          );
          const result = await modal.openAndWait();

          if (result.decision === 'accept' && result.editedText !== undefined) {
            new Notice(editContext.mode === 'cursor' ? 'Inserted' : 'Edit applied');
          }
        },
      });

      this.addCommand({
        id: 'new-tab',
        name: 'New tab',
        checkCallback: (checking: boolean) => {
          const leaf = this.app.workspace.getLeavesOfType(VIEW_TYPE_CLAUDIAN)[0];
          if (!leaf) return false;

          const view = leaf.view as ClaudianView;
          const tabManager = view.getTabManager();
          if (!tabManager) return false;

          if (!tabManager.canCreateTab()) return false;

          if (!checking) {
            tabManager.createTab();
          }
          return true;
        },
      });

      this.addCommand({
        id: 'new-session',
        name: 'New session (in current tab)',
        checkCallback: (checking: boolean) => {
          const leaf = this.app.workspace.getLeavesOfType(VIEW_TYPE_CLAUDIAN)[0];
          if (!leaf) return false;

          const view = leaf.view as ClaudianView;
          const tabManager = view.getTabManager();
          if (!tabManager) return false;

          const activeTab = tabManager.getActiveTab();
          if (!activeTab) return false;

          if (activeTab.state.isStreaming) return false;

          if (!checking) {
            tabManager.createNewConversation();
          }
          return true;
        },
      });

      this.addCommand({
        id: 'close-current-tab',
        name: 'Close current tab',
        checkCallback: (checking: boolean) => {
          const leaf = this.app.workspace.getLeavesOfType(VIEW_TYPE_CLAUDIAN)[0];
          if (!leaf) return false;

          const view = leaf.view as ClaudianView;
          const tabManager = view.getTabManager();
          if (!tabManager) return false;

          if (!checking) {
            const activeTabId = tabManager.getActiveTabId();
            if (activeTabId) {
              tabManager.closeTab(activeTabId);
            }
          }
          return true;
        },
      });

      this.addSettingTab(new ClaudianSettingTab(this.app, this));
    } catch (error) {
      console.error('[Claudian] Failed to register commands or settings UI.', error);
      new Notice('Claudian loaded with limited functionality. Check the console for details.');
    }

    this.scheduleStartupClaudeAuthCheck();
  }

  async onunload() {
    // Ensures state is saved even if Obsidian quits without calling onClose()
    for (const view of this.getAllViews()) {
      const tabManager = view.getTabManager();
      if (tabManager) {
        const state = tabManager.getPersistedState();
        await this.storage.setTabManagerState(state);
      }
    }
  }

  async activateView() {
    const { workspace } = this.app;
    let leaf = workspace.getLeavesOfType(VIEW_TYPE_CLAUDIAN)[0];

    if (!leaf) {
      const newLeaf = this.settings.openInMainTab
        ? workspace.getLeaf('tab')
        : workspace.getRightLeaf(false);
      if (newLeaf) {
        await newLeaf.setViewState({
          type: VIEW_TYPE_CLAUDIAN,
          active: true,
        });
        leaf = newLeaf;
      }
    }

    if (leaf) {
      workspace.revealLeaf(leaf);
    }
  }

  private scheduleStartupClaudeAuthCheck(): void {
    if (this.startupClaudeAuthCheckScheduled) {
      return;
    }

    const enabledProviders = ProviderRegistry.getEnabledProviderIds(
      this.settings as unknown as Record<string, unknown>,
    );
    if (!enabledProviders.includes('claude')) {
      return;
    }

    if (!this.getResolvedProviderCliPath('claude')) {
      return;
    }

    this.startupClaudeAuthCheckScheduled = true;
    const timer = window.setTimeout(() => {
      void this.runStartupClaudeAuthCheck();
    }, 2500);
    this.register(() => window.clearTimeout(timer));
  }

  private async runStartupClaudeAuthCheck(): Promise<void> {
    let runtime: (ReturnType<typeof ProviderRegistry.createChatRuntime> & {
      ensureAuthenticatedInteractive?: () => Promise<boolean>;
      cleanup?: () => void;
    }) | null = null;

    try {
      runtime = ProviderRegistry.createChatRuntime({
        plugin: this,
        providerId: 'claude',
      }) as ReturnType<typeof ProviderRegistry.createChatRuntime> & {
        ensureAuthenticatedInteractive?: () => Promise<boolean>;
        cleanup?: () => void;
      };
      await runtime.ensureAuthenticatedInteractive?.();
    } catch (error) {
      console.error('[Claudian] Claude startup auth check failed.', error);
    } finally {
      runtime?.cleanup?.();
    }
  }

  async loadSettings() {
    this.storage = new SharedStorageService(this);
    const { claudian } = await this.storage.initialize();

    this.settings = {
      ...DEFAULT_CLAUDIAN_SETTINGS,
      ...claudian,
    } as ClaudianSettings;

    // Plan mode is ephemeral 鈥?normalize back to normal on load so the app
    // doesn't start stuck in plan mode after a restart (prePlanPermissionMode is lost)
    if (this.settings.permissionMode === 'plan') {
      this.settings.permissionMode = 'normal';
    }

    const didNormalizeProviderSelection = ProviderSettingsCoordinator.normalizeProviderSelection(
      this.settings as unknown as Record<string, unknown>,
    );
    const didNormalizeModelVariants = this.normalizeModelVariantSettings();

    const allMetadata = await this.storage.sessions.listMetadata();
    this.initializeServices();
    this.conversations = this.conversationService.restoreFromMetadata(allMetadata);
    setLocale(this.settings.locale as Locale);

    const backfilledConversations = this.conversationService.backfillResponseTimestamps(this.conversations);

    const { changed, invalidatedConversations } = this.environmentService.reconcileModelWithEnvironment();

    ProviderSettingsCoordinator.projectActiveProviderState(
      this.settings as unknown as Record<string, unknown>,
    );

    if (changed || didNormalizeModelVariants || didNormalizeProviderSelection) {
      await this.saveSettings();
    }

    const conversationsToSave = new Set([...backfilledConversations, ...invalidatedConversations]);
    for (const conv of conversationsToSave) {
      await this.storage.sessions.saveMetadata(
        this.storage.sessions.toSessionMetadata(conv)
      );
    }
  }

  normalizeModelVariantSettings(): boolean {
    return ProviderSettingsCoordinator.normalizeAllModelVariants(
      this.settings as unknown as Record<string, unknown>,
    );
  }

  async saveSettings() {
    ProviderSettingsCoordinator.normalizeProviderSelection(
      this.settings as unknown as Record<string, unknown>,
    );
    ProviderSettingsCoordinator.persistProjectedProviderState(
      this.settings as unknown as Record<string, unknown>,
    );

    await this.storage.saveClaudianSettings(this.settings);
  }

  /** Updates and persists environment variables, restarting processes to apply changes. */
  async applyEnvironmentVariables(scope: EnvironmentScope, envText: string): Promise<void> {
    await this.environmentService.applyEnvironmentVariables(scope, envText);
  }

  async applyEnvironmentVariablesBatch(
    updates: Array<{ scope: EnvironmentScope; envText: string }>,
  ): Promise<void> {
    await this.environmentService.applyEnvironmentVariablesBatch(updates);
  }

  /** Returns the runtime environment variables (fixed at plugin load). */
  getActiveEnvironmentVariables(
    providerId: ProviderId = ProviderRegistry.resolveSettingsProviderId(
      this.settings as unknown as Record<string, unknown>,
    ),
  ): string {
    return this.environmentService.getActiveEnvironmentVariables(providerId);
  }

  getEnvironmentVariablesForScope(scope: EnvironmentScope): string {
    return this.environmentService.getEnvironmentVariablesForScope(scope);
  }

  getResolvedProviderCliPath(providerId: ProviderId): string | null {
    const cliResolver = ProviderWorkspaceRegistry.getCliResolver(providerId);
    if (!cliResolver) {
      return null;
    }

    return cliResolver.resolveFromSettings(this.settings as unknown as Record<string, unknown>);
  }

  private reconcileModelWithEnvironment(providerIds: ProviderId[] = ProviderRegistry.getRegisteredProviderIds()): {
    changed: boolean;
    invalidatedConversations: Conversation[];
  } {
    return this.environmentService.reconcileModelWithEnvironment(providerIds);
  }

  async createConversation(options?: {
    providerId?: ProviderId;
    sessionId?: string;
  }): Promise<Conversation> {
    return this.conversationService.createConversation(this.conversations, options);
  }

  async switchConversation(id: string): Promise<Conversation | null> {
    return this.conversationService.switchConversation(this.conversations, id);
  }

  async deleteConversation(id: string): Promise<void> {
    await this.conversationService.deleteConversation(this.conversations, id);
  }

  async renameConversation(id: string, title: string): Promise<void> {
    await this.conversationService.renameConversation(this.conversations, id, title);
  }

  async updateConversation(id: string, updates: Partial<Conversation>): Promise<void> {
    return this.conversationService.updateConversation(this.conversations, id, updates);
  }

  async getConversationById(id: string): Promise<Conversation | null> {
    return this.conversationService.getConversationById(this.conversations, id);
  }

  getConversationSync(id: string): Conversation | null {
    return this.conversationService.getConversationSync(this.conversations, id);
  }

  findEmptyConversation(): Conversation | null {
    return this.conversationService.findEmptyConversation(this.conversations);
  }

  getConversationList(): ConversationMeta[] {
    return this.conversationService.getConversationList(this.conversations);
  }

  getView(): ClaudianView | null {
    return this.viewService.getView();
  }

  getAllViews(): ClaudianView[] {
    return this.viewService.getAllViews();
  }

  findConversationAcrossViews(conversationId: string): { view: ClaudianView; tabId: string } | null {
    return this.viewService.findConversationAcrossViews(conversationId);
  }

}



