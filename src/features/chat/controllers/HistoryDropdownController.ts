import type ClaudianPlugin from '../../../main';
import type { TabData } from '../tabs/types';
import type { HistoryConversationOpenState } from './ConversationController';

interface HistoryDropdownControllerDeps {
  plugin: ClaudianPlugin;
  getCurrentView: () => unknown;
  getTabManager: () => {
    getActiveTab(): TabData | null;
    getAllTabs(): TabData[];
    openConversation(
      conversationId: string,
      options?: boolean | { preferNewTab?: boolean; activate?: boolean },
    ): Promise<void>;
  } | null;
  getDropdownEl: () => HTMLElement | null;
}

export class HistoryDropdownController {
  private readonly deps: HistoryDropdownControllerDeps;

  constructor(deps: HistoryDropdownControllerDeps) {
    this.deps = deps;
  }

  toggle(): void {
    const dropdown = this.deps.getDropdownEl();
    if (!dropdown) return;

    const isVisible = dropdown.hasClass('visible');
    if (isVisible) {
      dropdown.removeClass('visible');
      return;
    }

    this.update();
    dropdown.addClass('visible');
  }

  update(): void {
    const dropdown = this.deps.getDropdownEl();
    if (!dropdown) return;
    dropdown.empty();

    const activeTab = this.deps.getTabManager()?.getActiveTab();
    const conversationController = activeTab?.controllers.conversationController;

    if (conversationController) {
      conversationController.renderHistoryDropdown(dropdown, {
        onSelectConversation: (id) => this.openConversation(id),
        onOpenConversationInNewTab: (id, activate) => this.openConversationInNewTab(id, activate),
        getConversationOpenState: (id) => this.getConversationOpenState(id),
      });
    }
  }

  close(): void {
    this.deps.getDropdownEl()?.removeClass('visible');
  }

  private async openConversation(conversationId: string): Promise<void> {
    await this.deps.getTabManager()?.openConversation(conversationId);
    this.close();
  }

  private async openConversationInNewTab(
    conversationId: string,
    activate = true,
  ): Promise<void> {
    await this.deps.getTabManager()?.openConversation(conversationId, {
      preferNewTab: true,
      activate,
    });
    this.close();
  }

  private getConversationOpenState(conversationId: string): HistoryConversationOpenState {
    const activeTab = this.deps.getTabManager()?.getActiveTab();
    if (activeTab?.conversationId === conversationId) {
      return 'current';
    }

    if (this.findTabWithConversation(conversationId)) {
      return 'open';
    }

    const crossViewResult = this.deps.plugin.findConversationAcrossViews(conversationId);
    if (crossViewResult && crossViewResult.view !== this.deps.getCurrentView()) {
      return 'open';
    }

    return 'closed';
  }

  private findTabWithConversation(conversationId: string): TabData | null {
    const tabs = this.deps.getTabManager()?.getAllTabs() ?? [];
    return tabs.find(tab => tab.conversationId === conversationId) ?? null;
  }
}
