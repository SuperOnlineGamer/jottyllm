import type { EditorAiProvider } from "@/app/_types";

export type EditorAiAction =
  | "summarize"
  | "rewrite"
  | "shorten"
  | "expand"
  | "improve-clarity"
  | "change-tone"
  | "bullets"
  | "continue"
  | "brainstorm"
  | "prompt";

export interface EditorAiRequest {
  provider: EditorAiProvider;
  model?: string;
  action: EditorAiAction;
  prompt?: string;
  selectionText?: string;
  selectionHtml?: string;
  surroundingText?: string;
  noteTitle?: string;
  outputMode?: "preview" | "replace-selection" | "insert-after";
}

export interface EditorAiCompletionRequest {
  model: string;
  temperature: number;
  systemPrompt: string;
  userPrompt: string;
  signal?: AbortSignal;
}

export interface AiProviderModel {
  id: string;
  name: string;
}

export interface AiProviderStatus {
  ok: boolean;
  message: string;
  models?: AiProviderModel[];
}

export interface AiProviderAdapter {
  id: EditorAiProvider;
  listModels: (signal?: AbortSignal) => Promise<AiProviderModel[]>;
  testConnection: (signal?: AbortSignal) => Promise<AiProviderStatus>;
  streamCompletion: (
    request: EditorAiCompletionRequest,
  ) => AsyncGenerator<string>;
}

export interface SafeAiProviderMetadata {
  aiEnabled: boolean;
  defaultProvider: EditorAiProvider;
  temperature: number;
  maxInputCharacters: number;
  providers: Array<{
    id: EditorAiProvider;
    enabled: boolean;
    configured: boolean;
    defaultModel: string;
    models: AiProviderModel[];
  }>;
}
