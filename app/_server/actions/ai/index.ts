"use server";

import { getCurrentUser } from "@/app/_server/actions/users";
import {
  getAiProviderAdapter,
  getEditorAiSettings,
} from "@/app/_server/ai/config";
import {
  buildEditorAiPrompts,
  validateEditorAiRequest,
} from "@/app/_server/ai/editor-actions";
import type { Result } from "@/app/_types";

/**
 * @todo fccview is telling you to review this AI generated code
 * and make sure it's up to standards, reusable, modular and consistent with
 * the rest of the codebase.
 */
const getErrorMessage = (error: unknown): string => {
  return error instanceof Error ? error.message : "AI request failed.";
};

/**
 * @todo fccview is telling you to review this AI generated code
 * and make sure it's up to standards, reusable, modular and consistent with
 * the rest of the codebase.
 */
const collectAiCompletion = async (
  completion: AsyncGenerator<string>,
): Promise<string> => {
  let text = "";

  for await (const chunk of completion) {
    text += chunk;
  }

  return text;
};

/**
 * @todo fccview is telling you to review this AI generated code
 * and make sure it's up to standards, reusable, modular and consistent with
 * the rest of the codebase.
 */
export const requestEditorAiCompletion = async (
  formData: FormData,
): Promise<Result<{ text: string }>> => {
  try {
    const user = await getCurrentUser();
    if (!user) return { success: false, error: "Unauthorized" };

    const editorRequest = validateEditorAiRequest({
      provider: formData.get("provider"),
      model: formData.get("model"),
      action: formData.get("action"),
      prompt: formData.get("prompt"),
      selectionText: formData.get("selectionText"),
      selectionHtml: formData.get("selectionHtml"),
      surroundingText: formData.get("surroundingText"),
      noteTitle: formData.get("noteTitle"),
      outputMode: formData.get("outputMode"),
    });

    if (!editorRequest) {
      return { success: false, error: "Invalid AI editor request" };
    }

    const aiSettings = await getEditorAiSettings();
    const providerSettings = aiSettings.providers[editorRequest.provider];
    const provider = await getAiProviderAdapter(editorRequest.provider);

    if (!provider || !providerSettings.enabled) {
      return { success: false, error: "AI provider is not configured" };
    }

    const model = editorRequest.model?.trim() || providerSettings.defaultModel;
    if (!model) return { success: false, error: "AI model is required" };

    const { systemPrompt, userPrompt } = buildEditorAiPrompts(
      editorRequest,
      aiSettings.maxInputCharacters,
    );

    const text = await collectAiCompletion(
      provider.streamCompletion({
        model,
        temperature: aiSettings.temperature,
        systemPrompt,
        userPrompt,
      }),
    );

    return { success: true, data: { text } };
  } catch (error) {
    console.error("AI editor server action failed:", error);
    return { success: false, error: getErrorMessage(error) };
  }
};