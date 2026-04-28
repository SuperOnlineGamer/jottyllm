# Inline LLM Editor Plan

## Goal

Add LLM-assisted writing directly inside the rich text editor. The feature should feel native to the existing TipTap editor: no side chatbox, no detached assistant panel, and no provider secrets exposed to the browser.

Admins configure OpenAI or Ollama once in the existing settings area. During rich editing, users can choose the active provider/model from the top toolbar. Bubble-menu AI actions then respect that toolbar selection for summaries, rewrites, continuations, and prompt-based writing.

## Product Requirements

- Admins can enable or disable AI editor assistance from the existing settings menus.
- Admins can configure OpenAI once, including API key handling and default model.
- Admins can configure a local or network Ollama connection once, including base URL and default model.
- Admins can test provider connectivity from settings before saving or enabling the feature.
- Rich editor users can pick the active provider/model from the top toolbar.
- Bubble-menu AI actions use the selected toolbar provider/model.
- Selected text is the default input for selection-based actions.
- Cursor/no-selection actions use surrounding editor context and the user's prompt.
- AI output streams inline in the editor with clear loading, preview, accept, replace, insert, retry, and cancel states.
- Provider credentials and raw configuration secrets never reach client components.

## Admin Setup

The setup should live inside the pre-existing admin settings flow, most likely the editor settings tab.

Suggested settings fields:

- `editor.ai.enabled`: enables or disables AI editor controls.
- `editor.ai.providers.openai.enabled`: enables OpenAI as an available toolbar option.
- `editor.ai.providers.openai.defaultModel`: default OpenAI model.
- `editor.ai.providers.openai.keyConfigured`: display-only status for the UI.
- `editor.ai.providers.ollama.enabled`: enables Ollama as an available toolbar option.
- `editor.ai.providers.ollama.baseUrl`: Ollama server URL, for example `http://localhost:11434`.
- `editor.ai.providers.ollama.defaultModel`: default Ollama model.
- `editor.ai.defaultProvider`: provider selected by default for users.
- `editor.ai.temperature`: default generation temperature.
- `editor.ai.maxInputCharacters`: maximum selected/context text sent to a model.

OpenAI key storage needs special handling. The admin UI can accept a key, but the server should store or reference it through a server-only mechanism. Preferred options, in order:

1. Environment variable: `OPENAI_API_KEY`.
2. Server-only secret file path: `OPENAI_API_KEY_FILE`.
3. Server-only encrypted app secret store, if one is added for this feature.

If a direct settings-based key entry is implemented, the key must only travel through a server action or route handler, must never be returned to the browser, and should be displayed later only as a configured/not configured status.

## Provider Model

Use a provider abstraction so editor code does not know whether OpenAI or Ollama is handling the request.

Suggested server files:

- `app/_server/ai/types.ts`
- `app/_server/ai/config.ts`
- `app/_server/ai/providers/openai.ts`
- `app/_server/ai/providers/ollama.ts`
- `app/_server/ai/editor-actions.ts`
- `app/api/ai/editor/route.ts`
- `app/api/ai/providers/route.ts`

The provider interface should support:

- Listing available models.
- Testing connectivity.
- Streaming editor completions.
- Returning structured errors that are safe to show in the UI.
- Enforcing timeouts and maximum input size.

The `/api/ai/providers` route should return only safe metadata, such as enabled providers, available models, defaults, and health status. It must not return API keys or raw secret values.

The `/api/ai/editor` route should accept the active toolbar provider/model and stream generated text back to the editor.

## Ollama Security

Ollama base URLs create SSRF risk if accepted without validation. Validation should be at least as strict as the diagram proxy hardening.

Requirements:

- Only allow `http:` and `https:` protocols.
- Normalize and validate with the `URL` API.
- Block credentialed URLs.
- Apply request timeouts.
- Do not forward arbitrary user headers.
- Restrict paths to known Ollama API endpoints such as `/api/tags`, `/api/show`, and `/api/chat`.
- Consider an admin-controlled allowlist for private network hosts.
- Default to `http://localhost:11434` only when running server-side and explicitly enabled.

## Toolbar Behavior

Add an AI provider/model control to the rich text top toolbar.

Expected behavior:

- The control appears only when AI is enabled and at least one provider is configured.
- It shows the active provider and model.
- It lets users switch between configured OpenAI and Ollama models.
- The selection is kept in editor UI state and can be persisted as a user preference later.
- The active selection is passed to all AI bubble-menu and toolbar actions.
- If the selected provider becomes unavailable, the toolbar falls back to the admin default and shows a non-blocking error.

Candidate files:

- `app/_components/FeatureComponents/Notes/Parts/TipTap/Toolbar/TipTapToolbar.tsx`
- `app/_components/FeatureComponents/Notes/Parts/TipTap/Toolbar/ToolbarDropdown.tsx`
- `app/_components/FeatureComponents/Notes/Parts/TipTap/TipTapEditor.tsx`

## Bubble Menu Behavior

The bubble menu should respect the provider/model chosen in the toolbar.

Selection actions:

- Summarize selection.
- Rewrite selection.
- Shorten selection.
- Expand selection.
- Improve clarity.
- Change tone.
- Turn selection into bullets.

The bubble action request should include:

- Active provider.
- Active model.
- Selected text.
- Selected HTML when needed.
- Nearby plain-text context.
- Current note title or file name when available.
- Requested action.

Candidate file:

- `app/_components/FeatureComponents/Notes/Parts/TipTap/FloatingMenu/BubbleMenu.tsx`

## Inline Editing Experience

AI output should appear inside the editing surface or anchored to the selected text.

Suggested interaction:

1. User selects text or places the cursor.
2. User chooses an AI action from the toolbar or bubble menu.
3. The selection receives a subtle animated highlight.
4. A compact inline preview streams generated text.
5. User chooses `Accept`, `Replace`, `Insert Below`, `Try Again`, or `Cancel`.
6. On accept/replace/insert, TipTap applies the change as a normal editor transaction.

Implementation notes:

- Preserve undo/redo by applying accepted output through TipTap commands.
- Avoid directly injecting raw HTML from models.
- Prefer plain text or markdown-like output converted through existing safe conversion utilities.
- Abort in-flight generation when the user cancels, changes note, or switches editor mode.
- Keep animations subtle and operational: streaming caret, loading shimmer, and selection highlight are enough.

## Client Architecture

Suggested client pieces:

- `useEditorAiProviders`: loads safe provider/model metadata.
- `useEditorAiSelection`: tracks active provider/model and selected editor text.
- `useInlineAiCompletion`: handles streaming, aborting, retrying, and accept/cancel state.
- `AiModelDropdown`: toolbar provider/model picker.
- `AiActionMenu`: selection/cursor action menu.
- `InlineAiPreview`: anchored streaming preview and action buttons.

The current provider/model should be owned high enough in `TipTapEditor.tsx` that both the toolbar and bubble menu can consume it.

## Server Request Shape

Draft request payload:

```ts
type EditorAiRequest = {
  provider: "openai" | "ollama";
  model: string;
  action:
    | "summarize"
    | "rewrite"
    | "shorten"
    | "expand"
    | "improve-clarity"
    | "change-tone"
    | "bullets"
    | "continue"
    | "prompt";
  prompt?: string;
  selectionText?: string;
  selectionHtml?: string;
  surroundingText?: string;
  noteTitle?: string;
  outputMode: "preview" | "replace-selection" | "insert-after";
};
```

## Prompting Rules

System prompts should be strict and editor-focused:

- Return only the requested writing output.
- Do not wrap responses in chat phrasing.
- Preserve the user's language unless asked otherwise.
- Preserve markdown-like structure when useful.
- Do not invent facts for summaries.
- Do not include unsafe HTML or scripts.
- Keep output proportional to the selected text and requested action.

## Implementation Checklist

### Phase 1: Settings And Provider Foundation

- [x] Extend app settings types with `editor.ai` configuration.
- [x] Add default AI settings in config loading and updating.
- [x] Add admin editor settings UI for enabling AI providers.
- [x] Add OpenAI key configured status without exposing the key.
- [x] Add Ollama base URL/model settings and connectivity test.
- [x] Add server-side provider abstraction.
- [x] Add OpenAI streaming provider.
- [x] Add Ollama streaming provider.
- [x] Add provider metadata route for toolbar model discovery.
- [x] Add authenticated editor streaming route.

### Phase 2: Rich Text Editor MVP

- [x] Add toolbar AI model/provider dropdown.
- [x] Keep toolbar provider/model state in `TipTapEditor.tsx`.
- [x] Pass active provider/model into the bubble menu.
- [x] Add bubble action menu for selected text.
- [x] Implement `rewrite selection` as the first end-to-end action.
- [x] Stream output into an inline preview.
- [ ] Add full accept, replace, retry, and cancel controls.

### Phase 3: Expanded Actions

- [ ] Add summarize selection.
- [ ] Add shorten selection.
- [ ] Add expand selection.
- [ ] Add improve clarity.
- [ ] Add tone rewrite.
- [ ] Add turn into bullets.
- [ ] Add cursor-based continue writing.
- [ ] Add prompt-based insert.

### Phase 4: Markdown Mode

- [ ] Add markdown textarea selection support.
- [ ] Reuse the same provider/model toolbar selection.
- [ ] Insert accepted output through markdown editor utilities.
- [ ] Keep rich and markdown mode behavior consistent.

### Phase 5: Polish And Hardening

- [ ] Add request timeout and abort handling.
- [ ] Add max input and max output safeguards.
- [ ] Add provider health/error states.
- [ ] Add safe audit logging without note content.
- [ ] Add focused tests for settings parsing and provider route safety.
- [ ] Add UI tests for toolbar model selection and bubble action flow.
- [ ] Add documentation for admin setup after implementation stabilizes.

## Testing Plan

- Unit test AI settings defaults and backwards compatibility with old settings files.
- Unit test OpenAI key redaction and configured status.
- Unit test Ollama URL validation and blocked URL cases.
- Unit test provider selection fallback behavior.
- Route test safe provider metadata output.
- Route test unauthenticated editor requests are rejected.
- Route test configured provider/model is required.
- Component test toolbar model switching.
- Component test bubble menu uses toolbar-selected provider/model.
- Component test cancel aborts streaming and leaves editor content unchanged.

## Open Decisions

- Should the selected toolbar provider/model persist globally per user, per device, or per note?
- Should OpenAI keys be accepted in the admin UI, env-only, or both?
- Should Ollama private network URLs require an explicit admin allowlist?
- Should markdown mode ship in the first release or follow rich text MVP?
- Which OpenAI package/version should be added, or should OpenAI-compatible requests use native `fetch` first?

## First Implementation Slice

Build the smallest useful version first:

1. Admin can enable AI and configure OpenAI or Ollama.
2. Server exposes safe provider/model metadata.
3. Rich editor toolbar shows the provider/model picker.
4. Bubble menu uses the toolbar-selected provider/model.
5. `Rewrite selection` streams into an inline preview.
6. User can accept, replace, retry, or cancel.

This proves the desired product loop while keeping the implementation compact enough to iterate safely.