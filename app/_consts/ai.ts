import type { EditorAiSettings } from "@/app/_types";

export const DEFAULT_OPENAI_MODEL = "gpt-4o-mini";
export const DEFAULT_OLLAMA_BASE_URL = "http://localhost:11434";
export const DEFAULT_OLLAMA_MODEL = "llama3.1";
export const DEFAULT_AI_TEMPERATURE = 0.4;
export const DEFAULT_AI_MAX_INPUT_CHARACTERS = 6000;
export const AI_REQUEST_TIMEOUT_MS = 30000;

export const DEFAULT_EDITOR_AI_SETTINGS: EditorAiSettings = {
  enabled: false,
  defaultProvider: "openai",
  temperature: DEFAULT_AI_TEMPERATURE,
  maxInputCharacters: DEFAULT_AI_MAX_INPUT_CHARACTERS,
  providers: {
    openai: {
      enabled: false,
      defaultModel: DEFAULT_OPENAI_MODEL,
      keyConfigured: false,
    },
    ollama: {
      enabled: false,
      baseUrl: DEFAULT_OLLAMA_BASE_URL,
      defaultModel: DEFAULT_OLLAMA_MODEL,
    },
  },
};
