import type { ProviderRegistration } from '../../core/providers/types';
import { CodexInlineEditService } from '../codex/auxiliary/CodexInlineEditService';
import { CodexInstructionRefineService } from '../codex/auxiliary/CodexInstructionRefineService';
import { CodexTaskResultInterpreter } from '../codex/auxiliary/CodexTaskResultInterpreter';
import { CodexTitleGenerationService } from '../codex/auxiliary/CodexTitleGenerationService';
import { codexSubagentLifecycleAdapter } from '../codex/normalization/codexSubagentNormalization';
import { CodexConversationHistoryService } from '../codex/history/CodexConversationHistoryService';
import { CodexChatRuntime } from '../codex/runtime/CodexChatRuntime';
import { getDeepSeekProviderSettings } from './settings';
import { DEEPSEEK_PROVIDER_CAPABILITIES } from './capabilities';
import { deepSeekSettingsReconciler } from './env/DeepSeekSettingsReconciler';
import { deepSeekChatUIConfig } from './ui/DeepSeekChatUIConfig';

export const deepSeekProviderRegistration: ProviderRegistration = {
  displayName: 'DeepSeek',
  blankTabOrder: 30,
  isEnabled: (settings) => getDeepSeekProviderSettings(settings, 'deepseek').enabled,
  capabilities: DEEPSEEK_PROVIDER_CAPABILITIES,
  environmentKeyPatterns: [/^OPENAI_/i, /^CODEX_/i],
  chatUIConfig: deepSeekChatUIConfig,
  settingsReconciler: deepSeekSettingsReconciler,
  createRuntime: ({ plugin }) => new CodexChatRuntime(plugin, {
    providerId: 'deepseek',
    capabilities: DEEPSEEK_PROVIDER_CAPABILITIES,
    defaultModel: 'deepseek-chat',
  }),
  createTitleGenerationService: (plugin) => new CodexTitleGenerationService(plugin),
  createInstructionRefineService: (plugin) => new CodexInstructionRefineService(plugin),
  createInlineEditService: (plugin) => new CodexInlineEditService(plugin),
  historyService: new CodexConversationHistoryService(),
  taskResultInterpreter: new CodexTaskResultInterpreter(),
  subagentLifecycleAdapter: codexSubagentLifecycleAdapter,
};
