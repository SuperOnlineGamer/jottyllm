import type { EditorAiAction, EditorAiRequest } from "./types";

const ACTION_INSTRUCTIONS: Record<EditorAiAction, string> = {
  summarize: "Summarize the provided document in a very brief, digestible way. Use 3 to 5 short bullets or compact sentences. Do not rewrite the source text.",
  rewrite: "Rewrite the selected text while preserving its meaning. If Selected HTML is provided, preserve the original structure as much as possible using Markdown-compatible formatting for headings, paragraphs, lists, tables, links, bold, and italics. Return only the rewritten content as Markdown or plain text. Do not wrap the result in a code fence and do not return raw HTML.",
  shorten: "Make the selected text shorter while keeping the important points.",
  expand: "Expand the selected text with useful detail while preserving the user's intent.",
  "improve-clarity": "Improve clarity, flow, and readability without changing the meaning.",
  "change-tone": "Rewrite the selected text in the requested tone. If no tone is provided, make it polished and professional.",
  bullets: "Turn the selected text into concise bullet points.",
  continue: "Continue writing from the cursor using the surrounding context.",
  brainstorm: "Brainstorm, expand, and organize the user's idea into a practical plan with useful sections and concrete next steps. Return concise Markdown using headings and bullet lists so it can be converted into rich editor blocks. Do not wrap the result in a code fence.",
  prompt: "Write content that follows the user's prompt and fits the surrounding note context.",
};

/**
 * @todo fccview is telling you to review this AI generated code
 * and make sure it's up to standards, reusable, modular and consistent with
 * the rest of the codebase.
 */
const cleanInput = (value: unknown, maxLength: number): string => {
  if (typeof value !== "string") return "";
  return value.replace(/\u0000/g, "").slice(0, maxLength).trim();
};

/**
 * @todo fccview is telling you to review this AI generated code
 * and make sure it's up to standards, reusable, modular and consistent with
 * the rest of the codebase.
 */
export const buildEditorAiPrompts = (
  request: EditorAiRequest,
  maxInputCharacters: number,
) => {
  const selectionText = cleanInput(request.selectionText, maxInputCharacters);
  const selectionHtml = cleanInput(request.selectionHtml, maxInputCharacters);
  const surroundingText = cleanInput(
    request.surroundingText,
    Math.min(maxInputCharacters, 3000),
  );
  const prompt = cleanInput(request.prompt, 2000);
  const noteTitle = cleanInput(request.noteTitle, 200);
  const actionInstruction = ACTION_INSTRUCTIONS[request.action];

  const systemPrompt = [
    "You are an inline writing assistant inside a rich text note editor.",
    "Return only the requested writing output.",
    "Do not include chatty prefixes, explanations, markdown fences, or unsafe HTML.",
    "Preserve the user's language unless the prompt asks for a change.",
    "Do not invent facts when summarizing provided text.",
  ].join(" ");

  const userPrompt = [
    `Action: ${actionInstruction}`,
    noteTitle ? `Note title: ${noteTitle}` : "",
    surroundingText ? `Surrounding context:\n${surroundingText}` : "",
    selectionHtml ? `Selected HTML:\n${selectionHtml}` : "",
    selectionText ? `Selected text:\n${selectionText}` : "",
    prompt ? `User prompt:\n${prompt}` : "",
  ]
    .filter(Boolean)
    .join("\n\n");

  return { systemPrompt, userPrompt };
};

/**
 * @todo fccview is telling you to review this AI generated code
 * and make sure it's up to standards, reusable, modular and consistent with
 * the rest of the codebase.
 */
export const validateEditorAiRequest = (body: any): EditorAiRequest | null => {
  const validActions = new Set(Object.keys(ACTION_INSTRUCTIONS));
  const validProviders = new Set(["openai", "ollama"]);

  if (!validProviders.has(body?.provider) || !validActions.has(body?.action)) {
    return null;
  }

  return {
    provider: body.provider,
    model: typeof body.model === "string" ? body.model : undefined,
    action: body.action,
    prompt: typeof body.prompt === "string" ? body.prompt : undefined,
    selectionText:
      typeof body.selectionText === "string" ? body.selectionText : undefined,
    selectionHtml:
      typeof body.selectionHtml === "string" ? body.selectionHtml : undefined,
    surroundingText:
      typeof body.surroundingText === "string" ? body.surroundingText : undefined,
    noteTitle: typeof body.noteTitle === "string" ? body.noteTitle : undefined,
    outputMode:
      body.outputMode === "replace-selection" || body.outputMode === "insert-after"
        ? body.outputMode
        : "preview",
  };
};
