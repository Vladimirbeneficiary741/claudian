import type ClaudianPlugin from '../../../main';
import type { TabBar } from '../tabs/TabBar';
import type { TabManager } from '../tabs/TabManager';

interface ViewStateControllerDeps {
  plugin: ClaudianPlugin;
  getTabManager: () => TabManager | null;
  getTabBar: () => TabBar | null;
  updateTabBarVisibility: () => void;
}

export class ViewStateController {
  private readonly deps: ViewStateControllerDeps;
  private pendingTabBarUpdate: number | null = null;
  private pendingPersist: ReturnType<typeof setTimeout> | null = null;

  constructor(deps: ViewStateControllerDeps) {
    this.deps = deps;
  }

  dispose(): void {
    if (this.pendingTabBarUpdate !== null) {
      cancelAnimationFrame(this.pendingTabBarUpdate);
      this.pendingTabBarUpdate = null;
    }
    if (this.pendingPersist !== null) {
      clearTimeout(this.pendingPersist);
      this.pendingPersist = null;
    }
  }

  updateTabBar(): void {
    const tabManager = this.deps.getTabManager();
    const tabBar = this.deps.getTabBar();
    if (!tabManager || !tabBar) return;

    if (this.pendingTabBarUpdate !== null) {
      cancelAnimationFrame(this.pendingTabBarUpdate);
    }

    this.pendingTabBarUpdate = requestAnimationFrame(() => {
      this.pendingTabBarUpdate = null;
      const currentTabManager = this.deps.getTabManager();
      const currentTabBar = this.deps.getTabBar();
      if (!currentTabManager || !currentTabBar) return;

      currentTabBar.update(currentTabManager.getTabBarItems());
      this.deps.updateTabBarVisibility();
    });
  }

  async restoreOrCreateTabs(): Promise<void> {
    const tabManager = this.deps.getTabManager();
    if (!tabManager) return;

    const persistedState = await this.deps.plugin.storage.getTabManagerState();
    if (persistedState && persistedState.openTabs.length > 0) {
      await tabManager.restoreState(persistedState);
      return;
    }

    await tabManager.createTab();
  }

  persistTabState(): void {
    if (this.pendingPersist !== null) {
      clearTimeout(this.pendingPersist);
    }

    this.pendingPersist = setTimeout(() => {
      this.pendingPersist = null;
      const tabManager = this.deps.getTabManager();
      if (!tabManager) return;

      const state = tabManager.getPersistedState();
      this.deps.plugin.storage.setTabManagerState(state).catch(() => {
        // Ignore persistence failures; the next state write can recover.
      });
    }, 300);
  }

  async persistTabStateImmediate(): Promise<void> {
    if (this.pendingPersist !== null) {
      clearTimeout(this.pendingPersist);
      this.pendingPersist = null;
    }

    const tabManager = this.deps.getTabManager();
    if (!tabManager) return;

    const state = tabManager.getPersistedState();
    await this.deps.plugin.storage.setTabManagerState(state);
  }
}
