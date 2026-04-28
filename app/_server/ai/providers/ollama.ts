import { AI_REQUEST_TIMEOUT_MS } from "@/app/_consts/ai";
import type {
  AiProviderAdapter,
  AiProviderModel,
  AiProviderStatus,
  EditorAiCompletionRequest,
} from "../types";

/**
 * @todo fccview is telling you to review this AI generated code
 * and make sure it's up to standards, reusable, modular and consistent with
 * the rest of the codebase.
 */
const withTimeout = (signal?: AbortSignal): AbortSignal => {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), AI_REQUEST_TIMEOUT_MS);

  signal?.addEventListener("abort", () => controller.abort(), { once: true });
  controller.signal.addEventListener("abort", () => clearTimeout(timeout), {
    once: true,
  });

  return controller.signal;
};

/**
 * @todo fccview is telling you to review this AI generated code
 * and make sure it's up to standards, reusable, modular and consistent with
 * the rest of the codebase.
 */
export const getOllamaApiUrl = (
  baseUrl: string,
  endpoint: "/api/tags" | "/api/chat",
): string | null => {
  try {
    const url = new URL(baseUrl);
    if (!["http:", "https:"].includes(url.protocol)) return null;
    if (url.username || url.password) return null;

    url.pathname = endpoint;
    url.search = "";
    url.hash = "";
    return url.toString();
  } catch {
    return null;
  }
};

/**
 * @todo fccview is telling you to review this AI generated code
 * and make sure it's up to standards, reusable, modular and consistent with
 * the rest of the codebase.
 */
const parseOllamaStreamLine = (line: string): string => {
  if (!line.trim()) return "";

  try {
    const parsed = JSON.parse(line);
    return parsed.message?.content || parsed.response || "";
  } catch {
    return "";
  }
};

const getOllamaErrorMessage = async (response: Response): Promise<string> => {
  const body = await response.text().catch(() => "");
  let detail = body.trim() || response.statusText;

  try {
    const parsed = JSON.parse(body);
    if (typeof parsed.error === "string") {
      detail = parsed.error;
    }
  } catch {}

  return `Ollama request failed with HTTP ${response.status}${
    detail ? `: ${detail.slice(0, 300)}` : ""
  }`;
};

/**
 * @todo fccview is telling you to review this AI generated code
 * and make sure it's up to standards, reusable, modular and consistent with
 * the rest of the codebase.
 */
export const createOllamaProvider = (baseUrl: string): AiProviderAdapter => {
  return {
    id: "ollama",
    listModels: async (signal?: AbortSignal): Promise<AiProviderModel[]> => {
      const url = getOllamaApiUrl(baseUrl, "/api/tags");
      if (!url) return [];

      const response = await fetch(url, { signal: withTimeout(signal) });
      if (!response.ok) return [];

      const data = await response.json();
      return Array.isArray(data.models)
        ? data.models
            .map((model: any) => ({
              id: String(model.name || ""),
              name: String(model.name || ""),
            }))
            .filter((model: AiProviderModel) => model.id)
        : [];
    },
    testConnection: async (signal?: AbortSignal): Promise<AiProviderStatus> => {
      const url = getOllamaApiUrl(baseUrl, "/api/tags");
      if (!url) {
        return { ok: false, message: "Ollama URL must be a valid HTTP(S) URL without credentials." };
      }

      try {
        const response = await fetch(url, { signal: withTimeout(signal) });
        if (!response.ok) {
          return { ok: false, message: `Ollama responded with HTTP ${response.status}.` };
        }

        const data = await response.json();
        const models = Array.isArray(data.models)
          ? data.models
              .map((model: any) => ({
                id: String(model.name || ""),
                name: String(model.name || ""),
              }))
              .filter((model: AiProviderModel) => model.id)
          : [];

        return {
          ok: true,
          message: models.length
            ? "Ollama connection successful."
            : "Ollama connection successful, but no models were returned.",
          models,
        };
      } catch {
        return { ok: false, message: "Ollama connection failed." };
      }
    },
    streamCompletion: async function* (
      request: EditorAiCompletionRequest,
    ): AsyncGenerator<string> {
      const url = getOllamaApiUrl(baseUrl, "/api/chat");
      if (!url) throw new Error("Invalid Ollama URL.");

      const response = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: withTimeout(request.signal),
        body: JSON.stringify({
          model: request.model,
          stream: true,
          options: { temperature: request.temperature },
          messages: [
            { role: "system", content: request.systemPrompt },
            { role: "user", content: request.userPrompt },
          ],
        }),
      });

      if (!response.ok) {
        throw new Error(await getOllamaErrorMessage(response));
      }

      if (!response.body) {
        throw new Error("Ollama request did not return a response body.");
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          const content = parseOllamaStreamLine(line);
          if (content) yield content;
        }
      }
    },
  };
};
