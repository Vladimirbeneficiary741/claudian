import type { App, WorkspaceLeaf } from 'obsidian';

import { VIEW_TYPE_CLAUDIAN } from '../../core/types';
import type { ClaudianView } from '../../features/chat/ClaudianView';

export class ViewService {
  private readonly app: App;

  constructor(app: App) {
    this.app = app;
  }

  getLeaves(): WorkspaceLeaf[] {
    return this.app.workspace.getLeavesOfType(VIEW_TYPE_CLAUDIAN);
  }

  getView(): ClaudianView | null {
    const leaf = this.getLeaves()[0];
    return leaf ? (leaf.view as ClaudianView) : null;
  }

  getAllViews(): ClaudianView[] {
    return this.getLeaves().map(leaf => leaf.view as ClaudianView);
  }

  findConversationAcrossViews(conversationId: string): { view: ClaudianView; tabId: string } | null {
    for (const view of this.getAllViews()) {
      const tabManager = view.getTabManager();
      if (!tabManager) continue;

      for (const tab of tabManager.getAllTabs()) {
        if (tab.conversationId === conversationId) {
          return { view, tabId: tab.id };
        }
      }
    }

    return null;
  }
}
