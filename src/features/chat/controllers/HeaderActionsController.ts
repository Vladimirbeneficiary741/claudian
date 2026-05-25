import { setIcon } from 'obsidian';

interface HeaderActionsControllerDeps {
  onNewTab: () => Promise<void>;
  onNewConversation: () => Promise<void>;
  onToggleHistory: () => void;
}

interface HeaderActionsBuildResult {
  actionsEl: HTMLElement;
  historyDropdownEl: HTMLElement;
}

export class HeaderActionsController {
  private readonly deps: HeaderActionsControllerDeps;

  constructor(deps: HeaderActionsControllerDeps) {
    this.deps = deps;
  }

  build(): HeaderActionsBuildResult {
    const actionsEl = document.createElement('div');
    actionsEl.className = 'claudian-header-actions';

    const newTabBtn = actionsEl.createDiv({ cls: 'claudian-header-btn claudian-new-tab-btn' });
    setIcon(newTabBtn, 'square-plus');
    newTabBtn.setAttribute('aria-label', 'New tab');
    newTabBtn.addEventListener('click', async () => {
      await this.deps.onNewTab();
    });

    const newConversationBtn = actionsEl.createDiv({ cls: 'claudian-header-btn' });
    setIcon(newConversationBtn, 'square-pen');
    newConversationBtn.setAttribute('aria-label', 'New conversation');
    newConversationBtn.addEventListener('click', async () => {
      await this.deps.onNewConversation();
    });

    const historyContainer = actionsEl.createDiv({ cls: 'claudian-history-container' });
    const historyBtn = historyContainer.createDiv({ cls: 'claudian-header-btn' });
    setIcon(historyBtn, 'history');
    historyBtn.setAttribute('aria-label', 'Chat history');

    const historyDropdownEl = historyContainer.createDiv({ cls: 'claudian-history-menu' });
    historyBtn.addEventListener('click', (event) => {
      event.stopPropagation();
      this.deps.onToggleHistory();
    });

    return { actionsEl, historyDropdownEl };
  }
}
