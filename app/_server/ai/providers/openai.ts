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
const parseOpenAiSseLine = (line: string): string => {
  if (!line.startsWith("data: ")) return "";
  const payload = line.slice(6).trim();
  if (!payload || payload === "[DONE]") return "";

  try {
    const parsed = JSON.parse(payload);
    return parsed.choices?.[0]?.delta?.content || "";
  } catch {
    return "";
  }
};

const getOpenAiErrorMessage = async (response: Response): Promise<string> => {
  const body = await response.text().catch(() => "");
  let detail = body.trim() || response.statusText;

  try {
    const parsed = JSON.parse(body);
    if (typeof parsed.error?.message === "string") {
      detail = parsed.error.message;
    }
  } catch {}

  return `OpenAI request failed with HTTP ${response.status}${
    detail ? `: ${detail.slice(0, 300)}` : ""
  }`;
};

/**
 * @todo fccview is telling you to review this AI generated code
 * and make sure it's up to standards, reusable, modular and consistent with
 * the rest of the codebase.
 */
export const createOpenAiProvider = (apiKey: string): AiProviderAdapter => {
  const headers = {
    Authorization: `Bearer ${apiKey}`,
    "Content-Type": "application/json",
  };

  return {
    id: "openai",
    listModels: async (signal?: AbortSignal): Promise<AiProviderModel[]> => {
      if (!apiKey) return [];

      const response = await fetch("https://api.openai.com/v1/models", {
        headers,
        signal: withTimeout(signal),
      });
      if (!response.ok) return [];

      const data = await response.json();
      return Array.isArray(data.data)
        ? data.data
            .map((model: any) => ({ id: String(model.id), name: String(model.id) }))
            .filter((model: AiProviderModel) => model.id)
        : [];
    },
    testConnection: async (signal?: AbortSignal): Promise<AiProviderStatus> => {
      if (!apiKey) {
        return { ok: false, message: "OpenAI API key is not configured." };
      }

      try {
        const models = await createOpenAiProvider(apiKey).listModels(signal);
        return models.length
          ? { ok: true, message: "OpenAI connection successful.", models }
          : { ok: false, message: "OpenAI responded, but no models were returned." };
      } catch {
        return { ok: false, message: "OpenAI connection failed." };
      }
    },
    streamCompletion: async function* (
      request: EditorAiCompletionRequest,
    ): AsyncGenerator<string> {
      const response = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers,
        signal: withTimeout(request.signal),
        body: JSON.stringify({
          model: request.model,
          stream: true,
          temperature: request.temperature,
          messages: [
            { role: "system", content: request.systemPrompt },
            { role: "user", content: request.userPrompt },
          ],
        }),
      });

      if (!response.ok) {
        throw new Error(await getOpenAiErrorMessage(response));
      }

      if (!response.body) {
        throw new Error("OpenAI request did not return a response body.");
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
          const content = parseOpenAiSseLine(line.trim());
          if (content) yield content;
        }
      }
    },
  };
};
