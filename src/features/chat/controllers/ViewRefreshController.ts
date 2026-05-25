import { getHiddenProviderCommandSet } from '../../../core/providers/commands/hiddenCommands';
import { ProviderRegistry } from '../../../core/providers/ProviderRegistry';
import { ProviderSettingsCoordinator } from '../../../core/providers/ProviderSettingsCoordinator';
import type ClaudianPlugin from '../../../main';
import { getTabProviderId, onProviderAvailabilityChanged } from '../tabs/Tab';
import type { TabData } from '../tabs/types';
import { recalculateUsageForModel } from '../utils/usageInfo';

interface ViewRefreshControllerDeps {
  plugin: ClaudianPlugin;
  getTabs: () => TabData[];
}

export class ViewRefreshController {
  private readonly deps: ViewRefreshControllerDeps;

  constructor(deps: ViewRefreshControllerDeps) {
    this.deps = deps;
  }

  refreshModelSelector(): void {
    for (const tab of this.deps.getTabs()) {
      onProviderAvailabilityChanged(tab, this.deps.plugin);
      const providerId = getTabProviderId(tab, this.deps.plugin);
      const providerSettings = ProviderSettingsCoordinator.getProviderSettingsSnapshot(
        this.deps.plugin.settings as unknown as Record<string, unknown>,
        providerId,
      );
      const model = providerSettings.model as string;
      const uiConfig = ProviderRegistry.getChatUIConfig(providerId);
      const capabilities = ProviderRegistry.getCapabilities(providerId);
      const contextWindow = uiConfig.getContextWindowSize(
        model,
        providerSettings.customContextLimits as Record<string, number> | undefined,
      );

      if (tab.state.usage) {
        tab.state.usage = recalculateUsageForModel(tab.state.usage, model, contextWindow);
      }

      tab.ui.modelSelector?.updateDisplay();
      tab.ui.modelSelector?.renderOptions();
      tab.ui.thinkingBudgetSelector?.updateDisplay();
      tab.ui.permissionToggle?.updateDisplay();
      tab.ui.serviceTierToggle?.updateDisplay();
      tab.dom.inputWrapper.toggleClass(
        'claudian-input-plan-mode',
        this.deps.plugin.settings.permissionMode === 'plan' && capabilities.supportsPlanMode,
      );
    }
  }

  updateHiddenProviderCommands(): void {
    for (const tab of this.deps.getTabs()) {
      tab.ui.slashCommandDropdown?.setHiddenCommands(
        getHiddenProviderCommandSet(this.deps.plugin.settings, getTabProviderId(tab, this.deps.plugin)),
      );
    }
  }
}
