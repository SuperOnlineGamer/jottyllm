import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/app/_server/actions/users";
import {
  getAiProviderAdapter,
  getEditorAiSettings,
} from "@/app/_server/ai/config";
import {
  buildEditorAiPrompts,
  validateEditorAiRequest,
} from "@/app/_server/ai/editor-actions";

export const dynamic = "force-dynamic";

/**
 * @todo fccview is telling you to review this AI generated code
 * and make sure it's up to standards, reusable, modular and consistent with
 * the rest of the codebase.
 */
const jsonError = (message: string, status: number) => {
  return NextResponse.json({ error: message }, { status });
};

const getErrorMessage = (error: unknown): string => {
  return error instanceof Error ? error.message : "AI request failed.";
};

/**
 * @todo fccview is telling you to review this AI generated code
 * and make sure it's up to standards, reusable, modular and consistent with
 * the rest of the codebase.
 */
export async function POST(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return jsonError("Unauthorized", 401);

  const body = await request.json().catch(() => null);
  const editorRequest = validateEditorAiRequest(body);
  if (!editorRequest) return jsonError("Invalid AI editor request", 400);

  const aiSettings = await getEditorAiSettings();
  const providerSettings = aiSettings.providers[editorRequest.provider];
  const provider = await getAiProviderAdapter(editorRequest.provider);
  if (!provider || !providerSettings.enabled) {
    return jsonError("AI provider is not configured", 400);
  }

  const model = editorRequest.model?.trim() || providerSettings.defaultModel;
  if (!model) return jsonError("AI model is required", 400);

  const { systemPrompt, userPrompt } = buildEditorAiPrompts(
    editorRequest,
    aiSettings.maxInputCharacters,
  );
  const encoder = new TextEncoder();
  const completion = provider.streamCompletion({
    model,
    temperature: aiSettings.temperature,
    systemPrompt,
    userPrompt,
    signal: request.signal,
  });
  let firstChunk: IteratorResult<string>;

  try {
    firstChunk = await completion.next();
  } catch (error) {
    console.error("AI editor request failed:", error);
    return jsonError(getErrorMessage(error), 502);
  }

  const stream = new ReadableStream({
    async start(controller) {
      try {
        if (!firstChunk.done && firstChunk.value) {
          controller.enqueue(encoder.encode(firstChunk.value));
        }

        for await (const chunk of completion) {
          controller.enqueue(encoder.encode(chunk));
        }
        controller.close();
      } catch (error) {
        console.error("AI editor stream failed:", error);
        controller.enqueue(encoder.encode(`\n\n${getErrorMessage(error)}`));
        controller.close();
      }
    },
  });

  return new NextResponse(stream, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });
}
