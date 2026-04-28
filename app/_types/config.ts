export type EmojiMatchMode =
  | "exact"
  | "word"
  | "prefix"
  | "suffix"
  | "substring";

export interface EmojiConfig {
  emoji: string;
  match: EmojiMatchMode;
  caseSensitive?: boolean;
}

export interface EmojiDictionary {
  [key: string]: EmojiConfig | string;
}

export interface CustomThemeConfig {
  "custom-themes": {
    [key: string]: {
      name: string;
      icon?: string;
      colors: {
        [key: string]: string;
      };
    };
  };
}

export interface CustomEmojiConfig {
  "custom-emojis": {
    [key: string]: string;
  };
}

export type EditorAiProvider = "openai" | "ollama";

export interface EditorAiOpenAiSettings {
  enabled: boolean;
  defaultModel: string;
  keyConfigured?: boolean;
}

export interface EditorAiOllamaSettings {
  enabled: boolean;
  baseUrl: string;
  defaultModel: string;
}

export interface EditorAiSettings {
  enabled: boolean;
  defaultProvider: EditorAiProvider;
  temperature: number;
  maxInputCharacters: number;
  providers: {
    openai: EditorAiOpenAiSettings;
    ollama: EditorAiOllamaSettings;
  };
}

export interface EditorAiModelSelection {
  provider: EditorAiProvider;
  model: string;
}

export interface AppSettings {
  appName: string;
  appDescription: string;
  "16x16Icon": string;
  "32x32Icon": string;
  "180x180Icon": string;
  "512x512Icon": string;
  "192x192Icon": string;
  notifyNewUpdates: "yes" | "no";
  parseContent: "yes" | "no";
  maximumFileSize: number;
  adminContentAccess?: "yes" | "no";
  hideLanguageSelector?: "yes" | "no";
  maxLogAgeDays?: number;
  defaultDateFormat?: "dd/mm/yyyy" | "mm/dd/yyyy" | "yyyy/mm/dd";
  defaultTimeFormat?: "12-hours" | "24-hours";
  editor: {
    enableSlashCommands: boolean;
    enableBubbleMenu: boolean;
    enableTableToolbar: boolean;
    enableBilateralLinks: boolean;
    enableTags?: boolean;
    drawioUrl?: string;
    drawioProxyEnabled?: boolean;
    historyEnabled?: boolean;
    ai?: EditorAiSettings;
  };
}
