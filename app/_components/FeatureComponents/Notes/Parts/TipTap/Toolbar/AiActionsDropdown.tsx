"use client";

import { useEffect, useRef, useState } from "react";
import { Editor } from "@tiptap/react";
import {
  DOMParser as ProseMirrorDOMParser,
  DOMSerializer,
} from "@tiptap/pm/model";
import DOMPurify from "dompurify";
import { AiBeautifyIcon, ArrowDown01Icon } from "hugeicons-react";
import { Button } from "@/app/_components/GlobalComponents/Buttons/Button";
import { PromptModal } from "@/app/_components/GlobalComponents/Modals/ConfirmationModals/PromptModal";
import { ToolbarDropdown } from "./ToolbarDropdown";
import { convertMarkdownToHtml } from "@/app/_utils/markdown-utils";
import { useTranslations } from "next-intl";
import type { EditorAiModelSelection } from "@/app/_types";
import { requestEditorAiCompletion } from "@/app/_server/actions/ai";

type AiToolbarAction = "rewrite" | "summarize" | "brainstorm";

interface AiActionsDropdownProps {
  editor: Editor;
  activeAiModel: EditorAiModelSelection | null;
}

const SELECTION_ACTIONS = new Set<AiToolbarAction>(["rewrite"]);
const HTML_TAG_PATTERN = /<\/?[a-z][\s\S]*>/i;
const EMPTY_AI_RESPONSE_MESSAGE = "AI returned an empty response.";

/**
 * @todo fccview is telling you to review this AI generated code
 * and make sure it's up to standards, reusable, modular and consistent with
 * the rest of the codebase.
 */
const getSelectedText = (editor: Editor): string => {
  const { from, to } = editor.state.selection;
  return from === to ? "" : editor.state.doc.textBetween(from, to, " ");
};

/**
 * @todo fccview is telling you to review this AI generated code
 * and make sure it's up to standards, reusable, modular and consistent with
 * the rest of the codebase.
 */
const getSelectedHtml = (editor: Editor): string => {
  const { from, to } = editor.state.selection;
  if (from === to) return "";

  const slice = editor.state.doc.slice(from, to);
  const fragment = DOMSerializer.fromSchema(editor.schema).serializeFragment(
    slice.content,
  );
  const container = document.createElement("div");
  container.appendChild(fragment);
  return container.innerHTML;
};

/**
 * @todo fccview is telling you to review this AI generated code
 * and make sure it's up to standards, reusable, modular and consistent with
 * the rest of the codebase.
 */
const getDocumentText = (editor: Editor): string => {
  return editor.state.doc.textBetween(0, editor.state.doc.content.size, " ");
};

/**
 * @todo fccview is telling you to review this AI generated code
 * and make sure it's up to standards, reusable, modular and consistent with
 * the rest of the codebase.
 */
const getSurroundingText = (editor: Editor): string => {
  const { from, to } = editor.state.selection;
  const docEnd = editor.state.doc.content.size;

  return editor.state.doc.textBetween(
    Math.max(0, from - 1000),
    Math.min(docEnd, to + 1000),
    " ",
  );
};

/**
 * @todo fccview is telling you to review this AI generated code
 * and make sure it's up to standards, reusable, modular and consistent with
 * the rest of the codebase.
 */
const getErrorMessage = (error: unknown): string => {
  return error instanceof Error ? error.message : "AI request failed";
};

const isAbortError = (error: unknown): boolean => {
  return error instanceof DOMException && error.name === "AbortError";
};

/**
 * @todo fccview is telling you to review this AI generated code
 * and make sure it's up to standards, reusable, modular and consistent with
 * the rest of the codebase.
 */
const escapeHtml = (value: string): string => {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
};

/**
 * @todo fccview is telling you to review this AI generated code
 * and make sure it's up to standards, reusable, modular and consistent with
 * the rest of the codebase.
 */
const plainTextToHtml = (text: string): string => {
  const paragraphs = text
    .trim()
    .split(/\n{2,}/)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean);

  return paragraphs.length
    ? paragraphs
        .map((paragraph) => `<p>${escapeHtml(paragraph).replace(/\n/g, "<br>")}</p>`)
        .join("")
    : "";
};

/**
 * @todo fccview is telling you to review this AI generated code
 * and make sure it's up to standards, reusable, modular and consistent with
 * the rest of the codebase.
 */
const stripCodeFence = (content: string): string => {
  return content
    .trim()
    .replace(/^```(?:html|markdown|md)?\s*/i, "")
    .replace(/```$/i, "")
    .trim();
};

/**
 * @todo fccview is telling you to review this AI generated code
 * and make sure it's up to standards, reusable, modular and consistent with
 * the rest of the codebase.
 */
const sanitizeAiHtml = (html: string): string => {
  return DOMPurify.sanitize(html, {
    ADD_ATTR: ["data-type", "data-checked", "data-color", "data-tag"],
  });
};

/**
 * @todo fccview is telling you to review this AI generated code
 * and make sure it's up to standards, reusable, modular and consistent with
 * the rest of the codebase.
 */
const markdownToRichHtml = (content: string): string => {
  const cleanedContent = stripCodeFence(content);
  if (!cleanedContent) return "";

  try {
    return convertMarkdownToHtml(cleanedContent) || plainTextToHtml(cleanedContent);
  } catch {
    return plainTextToHtml(cleanedContent);
  }
};

/**
 * @todo fccview is telling you to review this AI generated code
 * and make sure it's up to standards, reusable, modular and consistent with
 * the rest of the codebase.
 */
const rewriteToRichHtml = (content: string): string => {
  const cleanedContent = stripCodeFence(content);
  if (!cleanedContent) return "";

  return HTML_TAG_PATTERN.test(cleanedContent)
    ? sanitizeAiHtml(cleanedContent)
    : markdownToRichHtml(cleanedContent);
};

/**
 * @todo fccview is telling you to review this AI generated code
 * and make sure it's up to standards, reusable, modular and consistent with
 * the rest of the codebase.
 */
const replaceEditorContent = (
  editor: Editor,
  from: number,
  to: number,
  html: string,
  addToHistory = true,
): number => {
  const docEnd = editor.state.doc.content.size;
  const safeFrom = Math.max(0, Math.min(from, docEnd));
  const safeTo = Math.max(safeFrom, Math.min(to, docEnd));
  const beforeSize = editor.state.doc.content.size;
  const transaction = editor.state.tr;

  if (html.trim()) {
    const container = document.createElement("div");
    container.innerHTML = sanitizeAiHtml(html);
    const slice = ProseMirrorDOMParser.fromSchema(editor.schema).parseSlice(
      container,
    );
    transaction.replaceRange(safeFrom, safeTo, slice);
  } else {
    transaction.delete(safeFrom, safeTo);
  }

  if (!addToHistory) {
    transaction.setMeta("addToHistory", false);
    transaction.setMeta("preventUpdate", true);
  }

  editor.view.dispatch(transaction);

  const insertedSize = editor.state.doc.content.size - beforeSize + (safeTo - safeFrom);
  return safeFrom + Math.max(0, insertedSize);
};

/**
 * @todo fccview is telling you to review this AI generated code
 * and make sure it's up to standards, reusable, modular and consistent with
 * the rest of the codebase.
 */
export const AiActionsDropdown = ({
  editor,
  activeAiModel,
}: AiActionsDropdownProps) => {
  const t = useTranslations();
  const aiRequestSequenceRef = useRef(0);
  const editorEditableRef = useRef<boolean | null>(null);
  const [showBrainstormModal, setShowBrainstormModal] = useState(false);
  const [aiError, setAiError] = useState("");
  const [summaryText, setSummaryText] = useState("");
  const [summaryError, setSummaryError] = useState("");
  const [showSummaryPanel, setShowSummaryPanel] = useState(false);
  const [isAiStreaming, setIsAiStreaming] = useState(false);
  const [isEditorLocked, setIsEditorLocked] = useState(false);

  const lockEditor = () => {
    if (editorEditableRef.current === null) {
      editorEditableRef.current = editor.isEditable;
      editor.setEditable(false, false);
    }
    setIsEditorLocked(true);
  };

  const unlockEditor = () => {
    if (editorEditableRef.current !== null) {
      editor.setEditable(editorEditableRef.current, false);
      editorEditableRef.current = null;
    }
    setIsEditorLocked(false);
  };

  useEffect(() => {
    return () => {
      aiRequestSequenceRef.current += 1;
      unlockEditor();
    };
  }, []);

  if (!activeAiModel) return null;

  const clearAiError = () => {
    aiRequestSequenceRef.current += 1;
    setAiError("");
    setIsAiStreaming(false);
    unlockEditor();
  };

  const requestAiResponse = async ({
    action,
    prompt,
    selectionText,
    selectionHtml,
    surroundingText,
  }: {
    action: AiToolbarAction;
    prompt?: string;
    selectionText: string;
    selectionHtml?: string;
    surroundingText: string;
  }): Promise<string> => {
    const requestId = aiRequestSequenceRef.current + 1;
    aiRequestSequenceRef.current = requestId;
    const formData = new FormData();
    formData.append("provider", activeAiModel.provider);
    formData.append("model", activeAiModel.model);
    formData.append("action", action);
    formData.append("selectionText", selectionText);
    formData.append("surroundingText", surroundingText);
    formData.append("outputMode", "preview");
    if (prompt) formData.append("prompt", prompt);
    if (selectionHtml) formData.append("selectionHtml", selectionHtml);

    const result = await requestEditorAiCompletion(formData);
    if (requestId !== aiRequestSequenceRef.current) {
      throw new DOMException("AI request was superseded.", "AbortError");
    }
    if (!result.success || !result.data) {
      throw new Error(result.error || "AI request failed");
    }

    return result.data.text;
  };

  const runSummary = async () => {
    const documentText = getDocumentText(editor).trim();
    setShowSummaryPanel(true);
    setSummaryText("");
    setSummaryError("");

    if (!documentText.trim()) {
      setSummaryError(t("editor.aiSummaryEmpty"));
      return;
    }

    setIsAiStreaming(true);

    try {
      const generatedText = await requestAiResponse({
        action: "summarize",
        selectionText: documentText,
        surroundingText: "",
      });
      setSummaryText(generatedText);
      if (!generatedText.trim()) {
        setSummaryError(EMPTY_AI_RESPONSE_MESSAGE);
      }
    } catch (error) {
      if (!isAbortError(error)) {
        setSummaryError(getErrorMessage(error));
      }
    } finally {
      setIsAiStreaming(false);
    }
  };

  const runAiAction = async (action: AiToolbarAction, prompt?: string) => {
    if (action === "summarize") {
      runSummary();
      return;
    }

    const { from, to } = editor.state.selection;
    const selectedText = getSelectedText(editor);
    const selectedHtml = action === "rewrite" ? getSelectedHtml(editor) : "";
    const originalHtml = action === "rewrite" ? selectedHtml : "";
    const needsSelection = SELECTION_ACTIONS.has(action);
    const insertFrom = action === "brainstorm" ? to : from;
    let currentTo = action === "brainstorm" ? to : to;
    let generatedText = "";
    const surroundingText = getSurroundingText(editor);

    setAiError("");

    if (needsSelection && !selectedText.trim()) {
      setAiError(t("editor.aiSelectionRequired"));
      return;
    }

    lockEditor();
    editor.view.focus();
    setIsAiStreaming(true);

    currentTo = replaceEditorContent(
      editor,
      insertFrom,
      currentTo,
      plainTextToHtml(t("editor.aiWriting")),
      false,
    );

    try {
      generatedText = await requestAiResponse({
        action,
        prompt,
        selectionText: selectedText,
        selectionHtml: selectedHtml || undefined,
        surroundingText,
      });

      const previewHtml =
        action === "brainstorm"
          ? markdownToRichHtml(generatedText)
          : rewriteToRichHtml(generatedText);
      currentTo = replaceEditorContent(
        editor,
        insertFrom,
        currentTo,
        previewHtml || plainTextToHtml(t("editor.aiWriting")),
        false,
      );

      if (!generatedText.trim()) {
        replaceEditorContent(editor, insertFrom, currentTo, originalHtml, false);
        setAiError(EMPTY_AI_RESPONSE_MESSAGE);
        return;
      }

      if (action === "brainstorm") {
        replaceEditorContent(editor, insertFrom, currentTo, "", false);
        replaceEditorContent(editor, insertFrom, insertFrom, markdownToRichHtml(generatedText));
      } else {
        const restoredTo = replaceEditorContent(
          editor,
          insertFrom,
          currentTo,
          originalHtml,
          false,
        );
        replaceEditorContent(
          editor,
          insertFrom,
          restoredTo,
          rewriteToRichHtml(generatedText),
        );
      }
    } catch (error) {
      if (!isAbortError(error)) {
        replaceEditorContent(editor, insertFrom, currentTo, originalHtml, false);
        setAiError(getErrorMessage(error));
      }
    } finally {
      setIsAiStreaming(false);
      unlockEditor();
      editor.view.focus();
    }
  };

  const confirmBrainstorm = (prompt: string) => {
    if (prompt.trim()) {
      runAiAction("brainstorm", prompt.trim());
    }
  };

  const actionButtonClass =
    "w-full px-3 py-2 text-left text-md lg:text-sm hover:bg-accent disabled:pointer-events-none disabled:opacity-50";
  const trigger = (
    <Button
      variant={isAiStreaming ? "secondary" : "ghost"}
      size="sm"
      onMouseDown={(event) => event.preventDefault()}
      className="flex items-center gap-1"
      title={t("editor.aiActions")}
      disabled={isAiStreaming}
    >
      <AiBeautifyIcon className="h-4 w-4" />
      <span className="hidden lg:inline">{t("editor.aiActions")}</span>
      <ArrowDown01Icon className="h-3 w-3" />
    </Button>
  );

  return (
    <>
      <ToolbarDropdown trigger={trigger} direction="right">
        <div className="flex flex-col py-1">
          <button
            type="button"
            className={actionButtonClass}
            onClick={(event) => {
              event.preventDefault();
              event.stopPropagation();
              runAiAction("rewrite");
            }}
            disabled={isAiStreaming}
          >
            {t("editor.aiRewrite")}
          </button>
          <button
            type="button"
            className={actionButtonClass}
            onClick={(event) => {
              event.preventDefault();
              event.stopPropagation();
              runSummary();
            }}
            disabled={isAiStreaming}
          >
            {t("editor.aiSummarize")}
          </button>
          <button
            type="button"
            className={actionButtonClass}
            onClick={(event) => {
              event.preventDefault();
              event.stopPropagation();
              setShowBrainstormModal(true);
            }}
            disabled={isAiStreaming}
          >
            {t("editor.aiBrainstorm")}
          </button>
        </div>
      </ToolbarDropdown>

      {isEditorLocked && (
        <div
          data-overlay
          className="fixed inset-0 z-40 cursor-progress bg-transparent"
          onMouseDown={(event) => {
            event.preventDefault();
            event.stopPropagation();
          }}
          onClick={(event) => {
            event.preventDefault();
            event.stopPropagation();
          }}
        />
      )}

      {aiError && (
        <div
          data-overlay
          className="fixed right-4 top-20 z-50 bg-card border border-border rounded-jotty shadow-lg p-3 w-[min(420px,calc(100vw-32px))] space-y-3"
          onMouseDown={(event) => event.stopPropagation()}
          onClick={(event) => event.stopPropagation()}
        >
          <div className="flex items-center gap-2 text-md lg:text-sm font-medium">
            <AiBeautifyIcon className="h-4 w-4 text-primary" />
            <span>{t("editor.aiError")}</span>
          </div>
          <div className="max-h-48 overflow-y-auto whitespace-pre-wrap text-md lg:text-sm bg-muted/40 rounded-jotty p-3 text-destructive">
            {aiError}
          </div>
          <div className="flex justify-end gap-2">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={clearAiError}
            >
              {t("editor.aiCancel")}
            </Button>
          </div>
        </div>
      )}

      {showSummaryPanel && (
        <div
          data-overlay
          className="fixed right-4 top-20 z-50 bg-card border border-border rounded-jotty shadow-lg p-4 w-[min(460px,calc(100vw-32px))] space-y-3"
          onMouseDown={(event) => event.stopPropagation()}
          onClick={(event) => event.stopPropagation()}
        >
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2 text-md lg:text-sm font-medium">
              <AiBeautifyIcon className="h-4 w-4 text-primary" />
              <span>{t("editor.aiSummary")}</span>
              {isAiStreaming && (
                <span className="h-2 w-2 rounded-full bg-primary animate-pulse" />
              )}
            </div>
            <Button
              type="button"
              variant="ghost"
              size="xs"
              onClick={() => setShowSummaryPanel(false)}
            >
              {t("common.close")}
            </Button>
          </div>
          <div className={`max-h-80 overflow-y-auto whitespace-pre-wrap text-md lg:text-sm bg-muted/40 rounded-jotty p-3 ${summaryError ? "text-destructive" : "text-foreground"}`}>
            {summaryError || summaryText || t("editor.aiWriting")}
          </div>
        </div>
      )}

      <PromptModal
        isOpen={showBrainstormModal}
        onClose={() => setShowBrainstormModal(false)}
        onConfirm={confirmBrainstorm}
        title={t("editor.aiBrainstorm")}
        message={t("editor.aiBrainstormMessage")}
        placeholder={t("editor.aiBrainstormPlaceholder")}
        confirmText={t("editor.aiBrainstormConfirm")}
      />
    </>
  );
};