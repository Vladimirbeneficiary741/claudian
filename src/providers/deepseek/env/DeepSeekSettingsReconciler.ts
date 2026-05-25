import type { ProviderSettingsReconciler } from '../../../core/providers/types';
import { createCodexCompatibleSettingsReconciler } from '../../codex/env/CodexSettingsReconciler';
import { deepSeekChatUIConfig } from '../ui/DeepSeekChatUIConfig';

export const deepSeekSettingsReconciler: ProviderSettingsReconciler =
  createCodexCompatibleSettingsReconciler('deepseek', deepSeekChatUIConfig, 'deepseek-chat');
