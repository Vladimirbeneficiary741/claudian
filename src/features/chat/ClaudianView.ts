import type { EventRef, WorkspaceLeaf } from 'obsidian';
import { ItemView, Notice, Scope, setIcon } from 'obsidian';

import { DEFAULT_CHAT_PROVIDER_ID } from '../../core/providers/types';
import { VIEW_TYPE_CLAUDIAN } from '../../core/types';
import type ClaudianPlugin from '../../main';
import { HeaderActionsController } from './controllers/HeaderActionsController';
import { HistoryDropdownController } from './controllers/HistoryDropdownController';
import { ViewRefreshController } from './controllers/ViewRefreshController';
import { ViewInteractionController } from './controllers/ViewInteractionController';
import { ViewLayoutController } from './controllers/ViewLayoutController';
import { ViewStateController } from './controllers/ViewStateController';
import { TabBar } from './tabs/TabBar';
import { TabManager } from './tabs/TabManager';
import type { TabData, TabId } from './tabs/types';

export class ClaudianView extends ItemView {
  private plugin: ClaudianPlugin;

  // Tab management
  private tabManager: TabManager | null = null;
  private tabBar: TabBar | null = null;
  private tabBarContainerEl: HTMLElement | null = null;
  private tabContentEl: HTMLElement | null = null;
  private navRowContent: HTMLElement | null = null;

  // DOM Elements
  private viewContainerEl: HTMLElement | null = null;
  private headerEl: HTMLElement | null = null;
  private titleSlotEl: HTMLElement | null = null;
  private logoEl: HTMLElement | null = null;
  private titleTextEl: HTMLElement | null = null;
  private headerActionsEl: HTMLElement | null = null;
  private headerActionsContent: HTMLElement | null = null;

  // Header elements
  private historyDropdown: HTMLElement | null = null;
  private historyDropdownController: HistoryDropdownController | null = null;
  private headerActionsController: HeaderActionsController | null = null;
  private viewInteractionController: ViewInteractionController | null = null;
  private viewLayoutController: ViewLayoutController | null = null;
  private viewRefreshController: ViewRefreshController | null = null;
  private viewStateController: ViewStateController | null = null;

  // Event refs for cleanup
  private eventRefs: EventRef[] = [];

  constructor(leaf: WorkspaceLeaf, plugin: ClaudianPlugin) {
    super(leaf);
    this.plugin = plugin;

    // Hover Editor compatibility: Define load as an instance method that can't be
    // overwritten by prototype patching. Hover Editor patches ClaudianView.prototype.load
    // after our class is defined, but instance methods take precedence over prototype methods.
    const originalLoad = Object.getPrototypeOf(this).load.bind(this);
    Object.defineProperty(this, 'load', {
      value: async () => {
        // Ensure containerEl exists before any patched load code tries to use it
        if (!this.containerEl) {
          (this as any).containerEl = createDiv({ cls: 'view-content' });
        }
        // Wrap in try-catch to prevent Hover Editor errors from breaking our view
        try {
          return await originalLoad();
        } catch {
          // Hover Editor may throw if its DOM setup fails - continue anyway
        }
      },
      writable: false,
      configurable: false,
    });
  }

  getViewType(): string {
    return VIEW_TYPE_CLAUDIAN;
  }

  getDisplayText(): string {
    return 'Claudian';
  }

  getIcon(): string {
    return 'bot';
  }

  /** Refreshes model-dependent UI across all tabs (used after settings/env changes). */
  refreshModelSelector(): void {
    this.viewRefreshController?.refreshModelSelector();
  }

  /** Updates provider-scoped hidden commands on all tabs after settings changes. */
  updateHiddenProviderCommands(): void {
    this.viewRefreshController?.updateHiddenProviderCommands();
  }

  async onOpen() {
    const container = this.resolveViewContainer();
    if (!container) {
      return;
    }

    this.viewContainerEl = container;
    this.viewContainerEl.empty();
    this.viewContainerEl.addClass('claudian-container');

    this.initializeViewControllers();

    const header = this.viewContainerEl.createDiv({ cls: 'claudian-header' });
    this.buildHeader(header);

    this.navRowContent = this.buildNavRowContent();
    this.tabContentEl = this.viewContainerEl.createDiv({ cls: 'claudian-tab-content-container' });

    this.initializeTabManager();
    this.initializeInteractionControllers();

    this.wireEventHandlers();
    await this.restoreOrCreateTabs();
    this.syncProviderBrandColor();
    this.updateLayoutForPosition();
  }

  async onClose() {
    this.releaseEventRefs();
    await this.persistViewStateOnClose();
    await this.destroyTabRuntime();
    this.disposeViewControllers();
    this.destroyTabBar();
  }

  private resolveViewContainer(): HTMLElement | null {
    if (!this.containerEl) {
      return null;
    }

    return this.contentEl ?? (this.containerEl.children[1] as HTMLElement | null) ?? this.containerEl.createDiv();
  }

  private releaseEventRefs(): void {
    for (const ref of this.eventRefs) {
      this.plugin.app.vault.offref(ref);
    }
    this.eventRefs = [];
  }

  private async persistViewStateOnClose(): Promise<void> {
    await this.viewStateController?.persistTabStateImmediate();
  }

  private async destroyTabRuntime(): Promise<void> {
    await this.tabManager?.destroy();
    this.tabManager = null;
  }

  private disposeViewControllers(): void {
    this.historyDropdownController = null;
    this.headerActionsController = null;
    this.viewInteractionController = null;
    this.viewLayoutController = null;
    this.viewRefreshController = null;
    this.viewStateController?.dispose();
    this.viewStateController = null;
  }

  private destroyTabBar(): void {
    this.tabBar?.destroy();
    this.tabBar = null;
  }

  private initializeViewControllers(): void {
    this.viewLayoutController = new ViewLayoutController({
      plugin: this.plugin,
      getViewContainerEl: () => this.viewContainerEl,
      getTitleSlotEl: () => this.titleSlotEl,
      getHeaderActionsEl: () => this.headerActionsEl,
      getHeaderActionsContent: () => this.headerActionsContent,
      getTabBarContainerEl: () => this.tabBarContainerEl,
      getLogoEl: () => this.logoEl,
      getTitleTextEl: () => this.titleTextEl,
      getNavRowContent: () => this.navRowContent,
      getActiveTab: () => this.tabManager?.getActiveTab() ?? null,
      getTabCount: () => this.tabManager?.getTabCount() ?? 0,
    });
    this.viewStateController = new ViewStateController({
      plugin: this.plugin,
      getTabManager: () => this.tabManager,
      getTabBar: () => this.tabBar,
      updateTabBarVisibility: () => this.updateTabBarVisibility(),
    });
    this.viewRefreshController = new ViewRefreshController({
      plugin: this.plugin,
      getTabs: () => this.tabManager?.getAllTabs() ?? [],
    });
  }

  private initializeTabManager(): void {
    if (!this.tabContentEl) {
      return;
    }

    this.tabManager = new TabManager(
      this.plugin,
      this.tabContentEl,
      this,
      this.createTabManagerCallbacks(),
    );
  }

  private createTabManagerCallbacks() {
    return {
      onTabCreated: () => {
        this.updateTabBar();
        this.updateNavRowLocation();
        this.persistTabState();
        this.syncProviderBrandColor();
      },
      onTabSwitched: () => {
        this.updateTabBar();
        this.updateHistoryDropdown();
        this.updateNavRowLocation();
        this.persistTabState();
        this.syncProviderBrandColor();
      },
      onTabClosed: () => {
        this.updateTabBar();
        this.persistTabState();
      },
      onTabStreamingChanged: () => this.updateTabBar(),
      onTabTitleChanged: () => this.updateTabBar(),
      onTabAttentionChanged: () => this.updateTabBar(),
      onTabConversationChanged: () => {
        this.persistTabState();
        this.syncProviderBrandColor();
      },
      onTabProviderChanged: () => {
        this.syncProviderBrandColor();
      },
    };
  }

  private initializeInteractionControllers(): void {
    this.historyDropdownController = new HistoryDropdownController({
      plugin: this.plugin,
      getCurrentView: () => this,
      getTabManager: () => this.tabManager,
      getDropdownEl: () => this.historyDropdown,
    });
    this.headerActionsController = new HeaderActionsController({
      onNewTab: () => this.handleNewTab(),
      onNewConversation: async () => {
        await this.tabManager?.createNewConversation();
        this.updateHistoryDropdown();
      },
      onToggleHistory: () => this.toggleHistoryDropdown(),
    });
    this.viewInteractionController = new ViewInteractionController({
      plugin: this.plugin,
      getActiveTab: () => this.tabManager?.getActiveTab() ?? null,
      closeHistoryDropdown: () => this.historyDropdownController?.close(),
    });
  }

  // ============================================
  // UI Building
  // ============================================

  private buildHeader(header: HTMLElement) {
    this.headerEl = header;

    // Title slot container (logo + title or tabs)
    this.titleSlotEl = header.createDiv({ cls: 'claudian-title-slot' });

    // Logo (hidden when 2+ tabs) — populated by syncHeaderLogo()
    this.logoEl = this.titleSlotEl.createSpan({ cls: 'claudian-logo' });
    this.viewLayoutController?.syncHeaderLogo(DEFAULT_CHAT_PROVIDER_ID);

    // Title text (hidden in header mode when 2+ tabs)
    this.titleTextEl = this.titleSlotEl.createEl('h4', { text: 'Claudian', cls: 'claudian-title-text' });

    // Header actions container (for header mode - initially hidden)
    this.headerActionsEl = header.createDiv({ cls: 'claudian-header-actions claudian-header-actions-slot' });
    this.headerActionsEl.style.display = 'none';
  }

  /**
   * Builds the nav row content (tab badges + header actions).
   * This is called once and the content is moved between locations.
   */
  private buildNavRowContent(): HTMLElement {
    // Create a fragment to hold nav row content
    const fragment = document.createDocumentFragment();

    // Tab badges (left side in nav row, or in title slot for header mode)
    this.tabBarContainerEl = document.createElement('div');
    this.tabBarContainerEl.className = 'claudian-tab-bar-container';
    this.tabBar = new TabBar(this.tabBarContainerEl, {
      onTabClick: (tabId) => this.handleTabClick(tabId),
      onTabClose: (tabId) => this.handleTabClose(tabId),
      onNewTab: () => this.handleNewTab(),
    });
    fragment.appendChild(this.tabBarContainerEl);

    const headerActions = this.headerActionsController?.build();
    this.headerActionsContent = headerActions?.actionsEl ?? document.createElement('div');
    this.historyDropdown = headerActions?.historyDropdownEl ?? null;

    fragment.appendChild(this.headerActionsContent);

    // Create a wrapper div to hold the fragment (for input mode nav row)
    const wrapper = document.createElement('div');
    wrapper.style.display = 'contents';
    wrapper.appendChild(fragment);
    return wrapper;
  }

  /**
   * Moves nav row content based on tabBarPosition setting.
   * - 'input' mode: Both tab badges and actions go to active tab's navRowEl
   * - 'header' mode: Tab badges go to title slot (after logo), actions go to header right side
   */
  private updateNavRowLocation(): void {
    this.viewLayoutController?.updateNavRowLocation();
  }

  /**
   * Updates layout when tabBarPosition setting changes.
   * Called from settings when user changes the tab bar position.
   */
  updateLayoutForPosition(): void {
    this.viewLayoutController?.updateLayoutForPosition();
  }

  // ============================================
  // Tab Management
  // ============================================

  private handleTabClick(tabId: TabId): void {
    this.tabManager?.switchToTab(tabId);
  }

  private async handleTabClose(tabId: TabId): Promise<void> {
    const tab = this.tabManager?.getTab(tabId);
    // If streaming, treat close like user interrupt (force close cancels the stream)
    const force = tab?.state.isStreaming ?? false;
    await this.tabManager?.closeTab(tabId, force);
    this.updateTabBarVisibility();
  }

  private async handleNewTab(): Promise<void> {
    const tab = await this.tabManager?.createTab();
    if (!tab) {
      const maxTabs = this.plugin.settings.maxTabs ?? 3;
      new Notice(`Maximum ${maxTabs} tabs allowed`);
      return;
    }
    this.updateTabBarVisibility();
  }

  private updateTabBar(): void {
    this.viewStateController?.updateTabBar();
  }

  private updateTabBarVisibility(): void {
    this.viewLayoutController?.updateTabBarVisibility(this.tabManager?.getTabCount() ?? 0);
  }

  /** Sets `data-provider` on the root container so CSS brand color follows the active provider. */
  private syncProviderBrandColor(): void {
    this.viewLayoutController?.syncProviderBrandColor();
  }

  // ============================================
  // History Dropdown
  // ============================================

  private toggleHistoryDropdown(): void {
    this.historyDropdownController?.toggle();
  }

  private updateHistoryDropdown(): void {
    this.historyDropdownController?.update();
  }

  // ============================================
  // Event Wiring
  // ============================================

  private wireEventHandlers(): void {
    this.registerDomEvent(this.containerEl, 'keydown', (e: KeyboardEvent) => {
      if (e.key === 'Tab' && e.shiftKey && !e.isComposing) {
        e.preventDefault();
        this.viewInteractionController?.handlePlanModeShortcut();
      }
    });

    this.scope = new Scope(this.app.scope);
    this.scope.register([], 'Escape', () => this.viewInteractionController?.handleEscape() ?? false);

    this.eventRefs.push(
      this.plugin.app.vault.on('create', () => this.viewInteractionController?.markActiveFileContextDirty(true)),
      this.plugin.app.vault.on('delete', () => this.viewInteractionController?.markActiveFileContextDirty(true)),
      this.plugin.app.vault.on('rename', () => this.viewInteractionController?.markActiveFileContextDirty(true)),
      this.plugin.app.vault.on('modify', () => this.viewInteractionController?.markActiveFileContextDirty(false))
    );

    this.registerEvent(
      this.plugin.app.workspace.on('file-open', (file) => {
        this.viewInteractionController?.handleWorkspaceFileOpen(file);
      })
    );

    this.registerDomEvent(document, 'click', (e) => {
      this.viewInteractionController?.handleDocumentClick(e.target as Node | null);
    });
  }

  // ============================================
  // Persistence
  // ============================================

  private async restoreOrCreateTabs(): Promise<void> {
    await this.viewStateController?.restoreOrCreateTabs();
  }

  private persistTabState(): void {
    this.viewStateController?.persistTabState();
  }

  /** Force immediate persistence (for onClose/onunload). */
  private async persistTabStateImmediate(): Promise<void> {
    await this.viewStateController?.persistTabStateImmediate();
  }

  // ============================================
  // Public API
  // ============================================

  /** Gets the currently active tab. */
  getActiveTab(): TabData | null {
    return this.tabManager?.getActiveTab() ?? null;
  }

  /** Gets the tab manager. */
  getTabManager(): TabManager | null {
    return this.tabManager;
  }
}
