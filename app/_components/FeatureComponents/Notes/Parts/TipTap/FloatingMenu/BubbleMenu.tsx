"use client";

import { Editor } from "@tiptap/react";
import {
  DOMParser as ProseMirrorDOMParser,
  DOMSerializer,
} from "@tiptap/pm/model";
import DOMPurify from "dompurify";
import {
  TextBoldIcon,
  TextItalicIcon,
  TextUnderlineIcon,
  TextStrikethroughIcon,
  SourceCodeIcon,
  Attachment01Icon,
  PaintBrush04Icon,
  PenTool01Icon,
  AiBeautifyIcon,
} from "hugeicons-react";
import { Button } from "@/app/_components/GlobalComponents/Buttons/Button";
import { ColorPicker } from "../ColorPicker/ColorPicker";
import { useState, useRef, useEffect } from "react";
import { PromptModal } from "@/app/_components/GlobalComponents/Modals/ConfirmationModals/PromptModal";
import { convertMarkdownToHtml } from "@/app/_utils/markdown-utils";
import { useTranslations } from "next-intl";
import type { EditorAiModelSelection } from "@/app/_types";

const HTML_TAG_PATTERN = /<\/?[a-z][\s\S]*>/i;

/**
 * @todo fccview is telling you to review this AI generated code
 * and make sure it's up to standards, reusable, modular and consistent with
 * the rest of the codebase.
 */
const getSelectedHtml = (editor: Editor, from: number, to: number): string => {
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
const normalizeRewriteHtml = (content: string): string => {
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
const getReadableAiPreview = (content: string): string => {
  const cleanedContent = stripCodeFence(content);
  if (!HTML_TAG_PATTERN.test(cleanedContent)) return cleanedContent;

  const container = document.createElement("div");
  container.innerHTML = sanitizeAiHtml(cleanedContent);
  return container.textContent || cleanedContent;
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
) => {
  if (!html.trim()) return;

  const container = document.createElement("div");
  container.innerHTML = sanitizeAiHtml(html);
  const slice = ProseMirrorDOMParser.fromSchema(editor.schema).parseSlice(
    container,
  );
  editor.view.dispatch(editor.state.tr.replaceRange(from, to, slice));
};

interface BubbleMenuProps {
  editor: Editor;
  isVisible: boolean;
  onClose: () => void;
  activeAiModel?: EditorAiModelSelection | null;
}

export const BubbleMenu = ({
  editor,
  isVisible,
  onClose,
  activeAiModel = null,
}: BubbleMenuProps) => {
  const t = useTranslations();
  const [showTextColorPicker, setShowTextColorPicker] = useState(false);
  const [showHighlightPicker, setShowHighlightPicker] = useState(false);
  const [showLinkModal, setShowLinkModal] = useState(false);
  const [previousUrl, setPreviousUrl] = useState("");
  const [aiPreview, setAiPreview] = useState("");
  const [aiError, setAiError] = useState("");
  const [isAiStreaming, setIsAiStreaming] = useState(false);
  const [aiSelectionRange, setAiSelectionRange] = useState<{
    from: number;
    to: number;
  } | null>(null);
  const [aiPreviewPosition, setAiPreviewPosition] = useState({ x: 0, y: 0 });
  const [colorPickerPosition, setColorPickerPosition] = useState({
    x: 0,
    y: 0,
  });
  const [targetElement, setTargetElement] = useState<HTMLElement | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const aiAbortControllerRef = useRef<AbortController | null>(null);

  useEffect(() => {
    if (!isVisible || !menuRef.current) return;

    const updatePosition = () => {
      if (menuRef.current) {
        const { from, to } = editor.state.selection;
        if (from === to) return;

        const startCoords = editor.view.coordsAtPos(from);
        const endCoords = editor.view.coordsAtPos(to);
        const menuRect = menuRef.current.getBoundingClientRect();
        const viewportWidth = window.innerWidth;
        const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) ||
                         window.innerWidth < 768;

        let top: number;
        let left: number;

        if (isMobile) {
          top = endCoords.bottom + 20;
          left = endCoords.left;
        } else {
          top = startCoords.top - menuRect.height - 8;
          left = startCoords.left;
          if (top < 0) {
            top = startCoords.bottom + 8;
          }
        }

        if (left + menuRect.width > viewportWidth) {
          left = viewportWidth - menuRect.width - 8;
        }

        if (left < 0) {
          left = 8;
        }

        menuRef.current.style.left = `${left}px`;
        menuRef.current.style.top = `${top}px`;

        setColorPickerPosition({
          x: left,
          y: top - 10,
        });
        setTargetElement(menuRef.current);
      }
    };

    updatePosition();

    const handleScroll = () => updatePosition();
    const handleResize = () => updatePosition();

    window.addEventListener("scroll", handleScroll, true);
    window.addEventListener("resize", handleResize);

    return () => {
      window.removeEventListener("scroll", handleScroll, true);
      window.removeEventListener("resize", handleResize);
    };
  }, [isVisible, editor]);

  useEffect(() => {
    return () => {
      aiAbortControllerRef.current?.abort();
    };
  }, []);

  const setLink = () => {
    const currentUrl = editor.getAttributes("link").href;
    setPreviousUrl(currentUrl || "");
    setShowLinkModal(true);
  };

  const confirmSetLink = (url: string) => {
    if (url === "") {
      editor.chain().focus().unsetLink().run();
      return;
    }
    editor.chain().focus().setLink({ href: url }).run();
  };

  const handleTextColorSelect = (color: string) => {
    if (color) {
      editor.chain().focus().setColor(color).run();
    } else {
      editor.chain().focus().unsetColor().run();
    }
    setShowTextColorPicker(false);
  };

  const handleHighlightSelect = (color: string) => {
    if (color) {
      editor.chain().focus().setHighlight({ color }).run();
    } else {
      editor.chain().focus().unsetHighlight().run();
    }
    setShowHighlightPicker(false);
  };

  const getCurrentTextColor = () => {
    return editor.getAttributes("textStyle").color || "";
  };

  const getCurrentHighlightColor = () => {
    return editor.getAttributes("highlight").color || "";
  };

  const cancelAiPreview = () => {
    aiAbortControllerRef.current?.abort();
    aiAbortControllerRef.current = null;
    setAiPreview("");
    setAiError("");
    setIsAiStreaming(false);
    setAiSelectionRange(null);
  };

  const acceptAiPreview = () => {
    if (!aiPreview || !aiSelectionRange) return;

    replaceEditorContent(
      editor,
      aiSelectionRange.from,
      aiSelectionRange.to,
      normalizeRewriteHtml(aiPreview),
    );
    editor.view.focus();
    cancelAiPreview();
    onClose();
  };

  const runAiRewrite = async () => {
    if (!activeAiModel) return;

    const { from, to } = editor.state.selection;
    if (from === to) return;

    const selectedText = editor.state.doc.textBetween(from, to, " ");
    if (!selectedText.trim()) return;
    const selectedHtml = getSelectedHtml(editor, from, to);

    const docEnd = editor.state.doc.content.size;
    const surroundingText = editor.state.doc.textBetween(
      Math.max(0, from - 1000),
      Math.min(docEnd, to + 1000),
      " ",
    );
    const menuRect = menuRef.current?.getBoundingClientRect();
    setAiPreviewPosition({
      x: menuRect?.left || 8,
      y: (menuRect?.bottom || 0) + 8,
    });
    setAiSelectionRange({ from, to });
    setAiPreview("");
    setAiError("");
    setIsAiStreaming(true);

    const abortController = new AbortController();
    aiAbortControllerRef.current = abortController;

    try {
      const response = await fetch("/api/ai/editor", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: abortController.signal,
        body: JSON.stringify({
          provider: activeAiModel.provider,
          model: activeAiModel.model,
          action: "rewrite",
          selectionText: selectedText,
          selectionHtml: selectedHtml || undefined,
          surroundingText,
          outputMode: "preview",
        }),
      });

      if (!response.ok) {
        const errorPayload = await response.json().catch(() => null);
        throw new Error(errorPayload?.error || "AI rewrite failed");
      }

      if (!response.body) {
        throw new Error("AI rewrite failed");
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        setAiPreview((current) => current + decoder.decode(value, { stream: true }));
      }
    } catch (error) {
      if (!abortController.signal.aborted) {
        setAiPreview("");
        setAiError(error instanceof Error ? error.message : "AI rewrite failed");
      }
    } finally {
      if (aiAbortControllerRef.current === abortController) {
        aiAbortControllerRef.current = null;
      }
      setIsAiStreaming(false);
    }
  };

  if (!isVisible) return null;

  return (
    <>
      <div
        ref={menuRef}
        data-overlay
        className="fixed z-40 bg-card border border-border rounded-jotty shadow-lg p-1 flex items-center gap-1"
        onMouseDown={(e) => e.stopPropagation()}
        onClick={(e) => e.stopPropagation()}
      >
        <Button
          variant={editor.isActive("bold") ? "secondary" : "ghost"}
          size="sm"
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => editor.chain().focus().toggleBold().run()}
        >
          <TextBoldIcon className="h-4 w-4" />
        </Button>

        <Button
          variant={editor.isActive("italic") ? "secondary" : "ghost"}
          size="sm"
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => editor.chain().focus().toggleItalic().run()}
        >
          <TextItalicIcon className="h-4 w-4" />
        </Button>

        <Button
          variant={editor.isActive("underline") ? "secondary" : "ghost"}
          size="sm"
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => editor.chain().focus().toggleUnderline().run()}
        >
          <TextUnderlineIcon className="h-4 w-4" />
        </Button>

        <Button
          variant={editor.isActive("strike") ? "secondary" : "ghost"}
          size="sm"
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => editor.chain().focus().toggleStrike().run()}
        >
          <TextStrikethroughIcon className="h-4 w-4" />
        </Button>

        <Button
          variant={editor.isActive("code") ? "secondary" : "ghost"}
          size="sm"
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => editor.chain().focus().toggleCode().run()}
        >
          <SourceCodeIcon className="h-4 w-4" />
        </Button>

        <div className="w-px h-6 bg-border mx-1" />

        <Button
          variant={editor.isActive("link") ? "secondary" : "ghost"}
          size="sm"
          onMouseDown={(e) => e.preventDefault()}
          onClick={setLink}
        >
          <Attachment01Icon className="h-4 w-4" />
        </Button>

        <Button
          variant={editor.isActive("textStyle") ? "secondary" : "ghost"}
          size="sm"
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => setShowTextColorPicker(!showTextColorPicker)}
        >
          <PaintBrush04Icon className="h-4 w-4" />
        </Button>

        <Button
          variant={editor.isActive("highlight") ? "secondary" : "ghost"}
          size="sm"
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => setShowHighlightPicker(!showHighlightPicker)}
        >
          <PenTool01Icon className="h-4 w-4" />
        </Button>

        {activeAiModel && (
          <>
            <div className="w-px h-6 bg-border mx-1" />
            <Button
              variant={isAiStreaming || aiPreview ? "secondary" : "ghost"}
              size="sm"
              onMouseDown={(e) => e.preventDefault()}
              onClick={runAiRewrite}
              disabled={isAiStreaming}
              title={t("editor.aiRewriteSelection")}
            >
              <AiBeautifyIcon className="h-4 w-4" />
            </Button>
          </>
        )}
      </div>

      {(aiPreview || aiError || isAiStreaming) && (
        <div
          data-overlay
          className="fixed z-50 bg-card border border-border rounded-jotty shadow-lg p-3 w-[min(420px,calc(100vw-16px))] space-y-3"
          style={{
            left: `${Math.max(8, Math.min(aiPreviewPosition.x, window.innerWidth - 436))}px`,
            top: `${aiPreviewPosition.y}px`,
          }}
          onMouseDown={(e) => e.stopPropagation()}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex items-center gap-2 text-md lg:text-sm font-medium">
            <AiBeautifyIcon className="h-4 w-4 text-primary" />
            <span>{aiError ? t("editor.aiError") : t("editor.aiWriting")}</span>
            {isAiStreaming && !aiError && (
              <span className="h-2 w-2 rounded-full bg-primary animate-pulse" />
            )}
          </div>
          <div className={`max-h-48 overflow-y-auto whitespace-pre-wrap text-md lg:text-sm bg-muted/40 rounded-jotty p-3 ${aiError ? "text-destructive" : "text-foreground"}`}>
            {aiError || getReadableAiPreview(aiPreview) || t("editor.aiWriting")}
          </div>
          <div className="flex justify-end gap-2">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={cancelAiPreview}
            >
              {t("editor.aiCancel")}
            </Button>
            <Button
              type="button"
              size="sm"
              onClick={acceptAiPreview}
              disabled={!aiPreview || isAiStreaming || !!aiError}
            >
              {t("editor.aiAccept")}
            </Button>
          </div>
        </div>
      )}

      <ColorPicker
        isVisible={showTextColorPicker}
        onClose={() => setShowTextColorPicker(false)}
        onColorSelect={handleTextColorSelect}
        currentColor={getCurrentTextColor()}
        type="text"
        position={colorPickerPosition}
        targetElement={targetElement || undefined}
      />

      <ColorPicker
        isVisible={showHighlightPicker}
        onClose={() => setShowHighlightPicker(false)}
        onColorSelect={handleHighlightSelect}
        currentColor={getCurrentHighlightColor()}
        type="highlight"
        position={colorPickerPosition}
        targetElement={targetElement || undefined}
      />

      <PromptModal
        isOpen={showLinkModal}
        onClose={() => setShowLinkModal(false)}
        onConfirm={confirmSetLink}
        title={t("editor.addLink")}
        message={t("editor.enterURL")}
        placeholder="https://example.com"
        defaultValue={previousUrl}
        confirmText={t("common.confirm")}
      />
    </>
  );
};
