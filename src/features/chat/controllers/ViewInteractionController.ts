import type { TFile } from 'obsidian';

import { ProviderRegistry } from '../../../core/providers/ProviderRegistry';
import type ClaudianPlugin from '../../../main';
import { getTabProviderId, updatePlanModeUI } from '../tabs/Tab';
import type { TabData } from '../tabs/types';

interface ViewInteractionControllerDeps {
  plugin: ClaudianPlugin;
  getActiveTab: () => TabData | null;
  closeHistoryDropdown: () => void;
}

export class ViewInteractionController {
  private readonly deps: ViewInteractionControllerDeps;

  constructor(deps: ViewInteractionControllerDeps) {
    this.deps = deps;
  }

  handleDocumentClick(target: Node | null): void {
    this.deps.closeHistoryDropdown();

    const activeTab = this.deps.getActiveTab();
    if (!activeTab) return;

    const fileContextManager = activeTab.ui.fileContextManager;
    if (
      target &&
      fileContextManager &&
      !fileContextManager.containsElement(target) &&
      target !== activeTab.dom.inputEl
    ) {
      fileContextManager.hideMentionDropdown();
    }
  }

  handlePlanModeShortcut(): void {
    const activeTab = this.deps.getActiveTab();
    if (!activeTab) return;

    const providerId = getTabProviderId(activeTab, this.deps.plugin);
    if (!ProviderRegistry.getCapabilities(providerId).supportsPlanMode) return;

    const currentMode = this.deps.plugin.settings.permissionMode;
    if (currentMode === 'plan') {
      const restoreMode = activeTab.state.prePlanPermissionMode ?? 'normal';
      activeTab.state.prePlanPermissionMode = null;
      updatePlanModeUI(activeTab, this.deps.plugin, restoreMode);
      return;
    }

    activeTab.state.prePlanPermissionMode = currentMode;
    updatePlanModeUI(activeTab, this.deps.plugin, 'plan');
  }

  handleEscape(): false {
    const activeTab = this.deps.getActiveTab();
    if (activeTab?.state.isStreaming) {
      activeTab.controllers.inputController?.cancelStreaming();
    }
    return false;
  }

  markActiveFileContextDirty(includesFolders: boolean): void {
    const fileContextManager = this.deps.getActiveTab()?.ui.fileContextManager;
    if (!fileContextManager) return;

    fileContextManager.markFileCacheDirty();
    if (includesFolders) {
      fileContextManager.markFolderCacheDirty();
    }
  }

  handleWorkspaceFileOpen(file: TFile | null): void {
    if (!file) return;
    this.deps.getActiveTab()?.ui.fileContextManager?.handleFileOpen(file);
  }
}
