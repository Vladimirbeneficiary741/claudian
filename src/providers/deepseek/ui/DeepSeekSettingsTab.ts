import * as fs from 'fs';
import { Setting } from 'obsidian';

import type { ProviderSettingsTabRenderer } from '../../../core/providers/types';
import { renderEnvironmentSettingsSection } from '../../../features/settings/ui/EnvironmentSettingsSection';
import { getHostnameKey } from '../../../utils/env';
import { expandHomePath } from '../../../utils/path';
import { isWindowsStyleCliReference } from '../../codex/runtime/CodexBinaryLocator';
import { getDeepSeekProviderSettings, updateDeepSeekProviderSettings } from '../settings';

export const deepSeekSettingsTabRenderer: ProviderSettingsTabRenderer = {
  render(container, context) {
    const settingsBag = context.plugin.settings as unknown as Record<string, unknown>;
    const deepSeekSettings = getDeepSeekProviderSettings(settingsBag, 'deepseek');
    const hostnameKey = getHostnameKey();
    let installationMethod = deepSeekSettings.installationMethod;

    new Setting(container).setName('Setup').setHeading();

    new Setting(container)
      .setName('Enable DeepSeek provider')
      .setDesc('When enabled, DeepSeek models appear as an independent provider in Claudian.')
      .addToggle((toggle) =>
        toggle
          .setValue(deepSeekSettings.enabled)
          .onChange(async (value) => {
            updateDeepSeekProviderSettings(settingsBag, { enabled: value }, 'deepseek');
            await context.plugin.saveSettings();
            context.refreshModelSelectors();
          })
      );

    new Setting(container)
      .setName('Installation method')
      .setDesc('DeepSeek uses the same Codex-compatible CLI launcher. Native Windows is recommended on this machine.')
      .addDropdown((dropdown) => {
        dropdown
          .addOption('native-windows', 'Native Windows')
          .addOption('wsl', 'WSL')
          .setValue(installationMethod)
          .onChange(async (value) => {
            installationMethod = value === 'wsl' ? 'wsl' : 'native-windows';
            updateDeepSeekProviderSettings(settingsBag, { installationMethod }, 'deepseek');
            await context.plugin.saveSettings();
          });
      });

    const cliPathSetting = new Setting(container)
      .setName(`DeepSeek CLI path (${hostnameKey})`)
      .setDesc('Use the Codex CLI executable path here. DeepSeek is routed by OPENAI_* environment variables, not by a separate local binary.');

    const validationEl = container.createDiv({ cls: 'claudian-cli-path-validation' });
    validationEl.style.color = 'var(--text-error)';
    validationEl.style.fontSize = '0.85em';
    validationEl.style.marginTop = '-0.5em';
    validationEl.style.marginBottom = '0.5em';
    validationEl.style.display = 'none';

    const validatePath = (value: string): string | null => {
      const trimmed = value.trim();
      if (!trimmed) return null;

      if (installationMethod === 'wsl') {
        if (isWindowsStyleCliReference(trimmed)) {
          return 'WSL mode expects a Linux command or Linux absolute path, not a Windows executable path.';
        }
        return null;
      }

      const expandedPath = expandHomePath(trimmed);
      if (!fs.existsSync(expandedPath)) {
        return 'Path does not exist.';
      }
      if (!fs.statSync(expandedPath).isFile()) {
        return 'Path points to a directory, not an executable file.';
      }
      return null;
    };

    const cliPathsByHost = { ...deepSeekSettings.cliPathsByHost };

    cliPathSetting.addText((text) => {
      const currentValue = deepSeekSettings.cliPathsByHost[hostnameKey] || '';
      text
        .setPlaceholder('C:\\Users\\you\\.codex\\.sandbox-bin\\codex.exe')
        .setValue(currentValue)
        .onChange(async (value) => {
          const error = validatePath(value);
          if (error) {
            validationEl.setText(error);
            validationEl.style.display = 'block';
            text.inputEl.style.borderColor = 'var(--text-error)';
            return;
          }

          validationEl.style.display = 'none';
          text.inputEl.style.borderColor = '';

          const trimmed = value.trim();
          if (trimmed) {
            cliPathsByHost[hostnameKey] = trimmed;
          } else {
            delete cliPathsByHost[hostnameKey];
          }

          updateDeepSeekProviderSettings(settingsBag, { cliPathsByHost: { ...cliPathsByHost } }, 'deepseek');
          await context.plugin.saveSettings();
        });

      text.inputEl.addClass('claudian-settings-cli-path-input');
      text.inputEl.style.width = '100%';
    });

    new Setting(container).setName('Safety').setHeading();

    new Setting(container)
      .setName('DeepSeek safe mode')
      .setDesc('Controls filesystem sandboxing when using the DeepSeek provider.')
      .addDropdown((dropdown) => {
        dropdown
          .addOption('workspace-write', 'workspace-write')
          .addOption('read-only', 'read-only')
          .setValue(deepSeekSettings.safeMode)
          .onChange(async (value) => {
            updateDeepSeekProviderSettings(
              settingsBag,
              { safeMode: value as 'workspace-write' | 'read-only' },
              'deepseek',
            );
            await context.plugin.saveSettings();
          });
      });

    new Setting(container).setName('Models').setHeading();

    new Setting(container)
      .setName('Reasoning summary')
      .setDesc('Show a summary of the model reasoning in the thinking block.')
      .addDropdown((dropdown) => {
        dropdown
          .addOption('auto', 'Auto')
          .addOption('concise', 'Concise')
          .addOption('detailed', 'Detailed')
          .addOption('none', 'Off')
          .setValue(deepSeekSettings.reasoningSummary)
          .onChange(async (value) => {
            updateDeepSeekProviderSettings(
              settingsBag,
              { reasoningSummary: value as 'auto' | 'concise' | 'detailed' | 'none' },
              'deepseek',
            );
            await context.plugin.saveSettings();
          });
      });

    renderEnvironmentSettingsSection({
      container,
      plugin: context.plugin,
      scope: 'provider:deepseek',
      heading: 'Environment',
      name: 'DeepSeek environment',
      desc: 'Use OPENAI_* variables for DeepSeek compatibility. Recommended defaults are OPENAI_BASE_URL=https://api.deepseek.com/v1 and OPENAI_MODEL=deepseek-chat or deepseek-reasoner.',
      placeholder: 'OPENAI_API_KEY=your-deepseek-key\nOPENAI_BASE_URL=https://api.deepseek.com/v1\nOPENAI_MODEL=deepseek-chat',
      renderCustomContextLimits: (target) => context.renderCustomContextLimits(target, 'deepseek'),
    });
  },
};
