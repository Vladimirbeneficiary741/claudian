import type {
  ProviderChatUIConfig,
  ProviderIconSvg,
  ProviderPermissionModeToggleConfig,
  ProviderReasoningOption,
  ProviderUIOption,
} from '../../../core/providers/types';

const DEEPSEEK_ICON: ProviderIconSvg = {
  viewBox: '0 0 24 24',
  path: 'M12 2c4.97 0 9 4.03 9 9 0 5.52-4.48 11-9 11S3 16.52 3 11c0-4.97 4.03-9 9-9Zm-1.7 4.2a5.3 5.3 0 0 0-4.9 3.27 1 1 0 1 0 1.86.74A3.3 3.3 0 0 1 10.3 8.2h4.95a1 1 0 1 0 0-2H10.3Zm7.36 5.06a1 1 0 0 0-1.3.56A4.7 4.7 0 0 1 12 14.8H8.75a1 1 0 1 0 0 2H12a6.7 6.7 0 0 0 6.22-4.24 1 1 0 0 0-.56-1.3Zm-6.41-1.89a1.85 1.85 0 1 0 0 3.7 1.85 1.85 0 0 0 0-3.7Z',
};

const DEEPSEEK_MODELS: ProviderUIOption[] = [
  { value: 'deepseek-chat', label: 'DeepSeek Chat', description: 'General' },
  { value: 'deepseek-reasoner', label: 'DeepSeek Reasoner', description: 'Reasoning' },
];

const DEEPSEEK_MODEL_SET = new Set(DEEPSEEK_MODELS.map(model => model.value));

const EFFORT_LEVELS: ProviderReasoningOption[] = [
  { value: 'low', label: 'Low' },
  { value: 'medium', label: 'Medium' },
  { value: 'high', label: 'High' },
  { value: 'xhigh', label: 'XHigh' },
];

const DEEPSEEK_PERMISSION_MODE_TOGGLE: ProviderPermissionModeToggleConfig = {
  inactiveValue: 'normal',
  inactiveLabel: 'Safe',
  activeValue: 'yolo',
  activeLabel: 'YOLO',
  planValue: 'plan',
  planLabel: 'Plan',
};

const DEFAULT_CONTEXT_WINDOW = 128_000;

function looksLikeDeepSeekModel(model: string): boolean {
  return /^deepseek-/i.test(model);
}

export const deepSeekChatUIConfig: ProviderChatUIConfig = {
  getModelOptions(): ProviderUIOption[] {
    return [...DEEPSEEK_MODELS];
  },

  ownsModel(model: string): boolean {
    return DEEPSEEK_MODEL_SET.has(model) || looksLikeDeepSeekModel(model);
  },

  isAdaptiveReasoningModel(): boolean {
    return true;
  },

  getReasoningOptions(): ProviderReasoningOption[] {
    return [...EFFORT_LEVELS];
  },

  getDefaultReasoningValue(): string {
    return 'medium';
  },

  getContextWindowSize(): number {
    return DEFAULT_CONTEXT_WINDOW;
  },

  isDefaultModel(model: string): boolean {
    return DEEPSEEK_MODEL_SET.has(model);
  },

  applyModelDefaults(): void {
    // No-op
  },

  normalizeModelVariant(model: string): string {
    return model;
  },

  getCustomModelIds(): Set<string> {
    return new Set<string>();
  },

  getPermissionModeToggle(): ProviderPermissionModeToggleConfig {
    return DEEPSEEK_PERMISSION_MODE_TOGGLE;
  },

  getServiceTierToggle(): null {
    return null;
  },

  getProviderIcon() {
    return DEEPSEEK_ICON;
  },
};
