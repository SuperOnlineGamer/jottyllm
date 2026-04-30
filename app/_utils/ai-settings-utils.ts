import { DEFAULT_EDITOR_AI_SETTINGS } from "@/app/_consts/ai";
import type { EditorAiProvider, EditorAiSettings } from "@/app/_types";

const AI_PROVIDERS = new Set<EditorAiProvider>(["openai", "ollama"]);

/**
 * @todo fccview is telling you to review this AI generated code
 * and make sure it's up to standards, reusable, modular and consistent with
 * the rest of the codebase.
 */
const isAiProvider = (value: unknown): value is EditorAiProvider => {
  return typeof value === "string" && AI_PROVIDERS.has(value as EditorAiProvider);
};

/**
 * @todo fccview is telling you to review this AI generated code
 * and make sure it's up to standards, reusable, modular and consistent with
 * the rest of the codebase.
 */
const normalizeNumber = (
  value: unknown,
  fallback: number,
  min: number,
  max: number,
): number => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;

  return Math.min(max, Math.max(min, parsed));
};

/**
 * @todo fccview is telling you to review this AI generated code
 * and make sure it's up to standards, reusable, modular and consistent with
 * the rest of the codebase.
 */
export const normalizeEditorAiSettings = (
  settings?: Partial<EditorAiSettings> | null,
): EditorAiSettings => {
  const defaults = DEFAULT_EDITOR_AI_SETTINGS;
  const defaultProvider = isAiProvider(settings?.defaultProvider)
    ? settings.defaultProvider
    : defaults.defaultProvider;

  return {
    enabled:
      typeof settings?.enabled === "boolean" ? settings.enabled : defaults.enabled,
    defaultProvider,
    temperature: normalizeNumber(
      settings?.temperature,
      defaults.temperature,
      0,
      2,
    ),
    maxInputCharacters: Math.round(
      normalizeNumber(
        settings?.maxInputCharacters,
        defaults.maxInputCharacters,
        500,
        50000,
      ),
    ),
    providers: {
      openai: {
        enabled:
          typeof settings?.providers?.openai?.enabled === "boolean"
            ? settings.providers.openai.enabled
            : defaults.providers.openai.enabled,
        defaultModel:
          settings?.providers?.openai?.defaultModel?.trim() ||
          defaults.providers.openai.defaultModel,
        keyConfigured: Boolean(settings?.providers?.openai?.keyConfigured),
      },
      ollama: {
        enabled:
          typeof settings?.providers?.ollama?.enabled === "boolean"
            ? settings.providers.ollama.enabled
            : defaults.providers.ollama.enabled,
        baseUrl:
          settings?.providers?.ollama?.baseUrl?.trim() ||
          defaults.providers.ollama.baseUrl,
        defaultModel:
          settings?.providers?.ollama?.defaultModel?.trim() ||
          defaults.providers.ollama.defaultModel,
      },
    },
  };
};
