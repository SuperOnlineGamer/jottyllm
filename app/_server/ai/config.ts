import { getSettings } from "@/app/_server/actions/config";
import { normalizeEditorAiSettings } from "@/app/_utils/ai-settings-utils";
import type { EditorAiProvider, EditorAiSettings } from "@/app/_types";
import type { AiProviderAdapter, SafeAiProviderMetadata } from "./types";
import { getOpenAiApiKey, isOpenAiKeyConfigured } from "./secrets";
import { createOpenAiProvider } from "./providers/openai";
import { createOllamaProvider, getOllamaApiUrl } from "./providers/ollama";
import type { AiProviderModel } from "./types";

const EMBEDDING_MODEL_PATTERN = /(embed|embedding|nomic)/i;

const defaultModelOption = (model: string): AiProviderModel[] => {
  return model ? [{ id: model, name: model }] : [];
};

const prioritizeDefaultModel = (
  models: AiProviderModel[],
  defaultModel: string,
): AiProviderModel[] => {
  const uniqueModels = models.filter(
    (model, index, list) =>
      model.id && list.findIndex((item) => item.id === model.id) === index,
  );

  const defaultIndex = uniqueModels.findIndex(
    (model) => model.id === defaultModel,
  );
  if (defaultIndex <= 0) return uniqueModels;

  const prioritizedModels = [...uniqueModels];
  const [preferredModel] = prioritizedModels.splice(defaultIndex, 1);
  return [preferredModel, ...prioritizedModels];
};

const getOllamaModels = async (
  baseUrl: string,
  defaultModel: string,
): Promise<AiProviderModel[]> => {
  const models = await createOllamaProvider(baseUrl)
    .listModels()
    .catch(() => []);
  const chatModels = models.filter(
    (model) => !EMBEDDING_MODEL_PATTERN.test(model.id),
  );

  return prioritizeDefaultModel(
    chatModels.length ? chatModels : models,
    defaultModel,
  );
};

/**
 * @todo fccview is telling you to review this AI generated code
 * and make sure it's up to standards, reusable, modular and consistent with
 * the rest of the codebase.
 */
export const getEditorAiSettings = async (): Promise<EditorAiSettings> => {
  const settings = await getSettings();
  return normalizeEditorAiSettings(settings?.editor?.ai);
};

/**
 * @todo fccview is telling you to review this AI generated code
 * and make sure it's up to standards, reusable, modular and consistent with
 * the rest of the codebase.
 */
export const getAiProviderAdapter = async (
  provider: EditorAiProvider,
): Promise<AiProviderAdapter | null> => {
  const aiSettings = await getEditorAiSettings();
  if (!aiSettings.enabled) return null;

  if (provider === "openai") {
    if (!aiSettings.providers.openai.enabled) return null;
    const apiKey = await getOpenAiApiKey();
    return apiKey ? createOpenAiProvider(apiKey) : null;
  }

  if (!aiSettings.providers.ollama.enabled) return null;
  return createOllamaProvider(aiSettings.providers.ollama.baseUrl);
};

/**
 * @todo fccview is telling you to review this AI generated code
 * and make sure it's up to standards, reusable, modular and consistent with
 * the rest of the codebase.
 */
export const getSafeAiProviderMetadata = async (): Promise<SafeAiProviderMetadata> => {
  const aiSettings = await getEditorAiSettings();
  const openAiConfigured = await isOpenAiKeyConfigured();
  const ollamaConfigured = Boolean(
    getOllamaApiUrl(aiSettings.providers.ollama.baseUrl, "/api/chat"),
  );
  const ollamaModels = ollamaConfigured
    ? await getOllamaModels(
        aiSettings.providers.ollama.baseUrl,
        aiSettings.providers.ollama.defaultModel,
      )
    : [];

  return {
    aiEnabled: aiSettings.enabled,
    defaultProvider: aiSettings.defaultProvider,
    temperature: aiSettings.temperature,
    maxInputCharacters: aiSettings.maxInputCharacters,
    providers: [
      {
        id: "openai",
        enabled: aiSettings.providers.openai.enabled,
        configured: openAiConfigured,
        defaultModel: aiSettings.providers.openai.defaultModel,
        models: defaultModelOption(aiSettings.providers.openai.defaultModel),
      },
      {
        id: "ollama",
        enabled: aiSettings.providers.ollama.enabled,
        configured: ollamaConfigured,
        defaultModel: aiSettings.providers.ollama.defaultModel,
        models: ollamaModels.length
          ? ollamaModels
          : defaultModelOption(aiSettings.providers.ollama.defaultModel),
      },
    ],
  };
};
