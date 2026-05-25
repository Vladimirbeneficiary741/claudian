import { ProviderWorkspaceRegistry } from '../../../core/providers/ProviderWorkspaceRegistry';
import type { ProviderWorkspaceRegistration } from '../../../core/providers/types';
import type { HomeFileAdapter } from '../../../core/storage/HomeFileAdapter';
import type { VaultFileAdapter } from '../../../core/storage/VaultFileAdapter';
import type ClaudianPlugin from '../../../main';
import {
  createCodexWorkspaceServices,
  type CodexWorkspaceServices,
} from '../../codex/app/CodexWorkspaceServices';
import { deepSeekSettingsTabRenderer } from '../ui/DeepSeekSettingsTab';

export async function createDeepSeekWorkspaceServices(
  plugin: ClaudianPlugin,
  vaultAdapter: VaultFileAdapter,
  homeAdapter: HomeFileAdapter,
): Promise<CodexWorkspaceServices> {
  return createCodexWorkspaceServices(
    plugin,
    vaultAdapter,
    homeAdapter,
    'deepseek',
    deepSeekSettingsTabRenderer,
  );
}

export const deepSeekWorkspaceRegistration: ProviderWorkspaceRegistration<CodexWorkspaceServices> = {
  initialize: async ({ plugin, vaultAdapter, homeAdapter }) => createDeepSeekWorkspaceServices(
    plugin,
    vaultAdapter,
    homeAdapter,
  ),
};

export function maybeGetDeepSeekWorkspaceServices(): CodexWorkspaceServices | null {
  return ProviderWorkspaceRegistry.getServices('deepseek') as CodexWorkspaceServices | null;
}
