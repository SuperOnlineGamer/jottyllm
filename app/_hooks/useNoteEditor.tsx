import { useState, useEffect, useMemo, useRef, useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import {
  convertMarkdownToHtml,
  convertHtmlToMarkdownUnified,
  processMarkdownContent,
} from "@/app/_utils/markdown-utils";
import { useSettings } from "@/app/_utils/settings-store";
import { useEditorActivityStore } from "@/app/_utils/editor-activity-store";
import { useNavigationGuard } from "@/app/_providers/NavigationGuardProvider";
import { deleteNote, updateNote } from "@/app/_server/actions/note";
import { encryptNoteContent } from "@/app/_server/actions/pgp";
import { encryptXChaCha } from "@/app/_server/actions/xchacha";
import { logContentEvent, logAudit } from "@/app/_server/actions/log";
import {
  buildCategoryPath,
  encodeCategoryPath,
  encodeId,
} from "@/app/_utils/global-utils";
import { Note, NoteSaveOptions, NoteSaveState } from "@/app/_types";
import { useAppMode } from "@/app/_providers/AppModeProvider";
import { getUserByNote } from "../_server/actions/users";
import { extractYamlMetadata } from "@/app/_utils/yaml-metadata-utils";
import { normalizeTag, normalizeTagList } from "@/app/_utils/tag-utils";
import { ConfirmModal } from "@/app/_components/GlobalComponents/Modals/ConfirmationModals/ConfirmModal";

interface UseNoteEditorProps {
  note: Note;
  onUpdate: (updatedNote: Note) => void;
  onDelete: (deletedId: string) => void;
  onBack: () => void;
}

export const useNoteEditor = ({
  note,
  onUpdate,
  onDelete,
  onBack,
}: UseNoteEditorProps) => {
  const t = useTranslations();
  const searchParams = useSearchParams();
  const router = useRouter();
  const { user } = useAppMode();
  const isMinimalMode = user?.disableRichEditor === "enable";
  const defaultEditorIsMarkdown = user?.notesDefaultEditor === "markdown";
  const [title, setTitleState] = useState(note.title);
  const [category, setCategoryState] = useState(note.category || "Uncategorized");
  const [tags, setTagsState] = useState<string[]>(() => normalizeTagList(note.tags));
  const [editorContent, setEditorContent] = useState(() => {
    const { contentWithoutMetadata } = extractYamlMetadata(note.content || "");
    if (note.encrypted) {
      return contentWithoutMetadata;
    }
    if (isMinimalMode) {
      return contentWithoutMetadata;
    }
    if (defaultEditorIsMarkdown) {
      return contentWithoutMetadata;
    }
    return convertMarkdownToHtml(contentWithoutMetadata);
  });
  const [isMarkdownMode, setIsMarkdownMode] = useState(
    isMinimalMode || defaultEditorIsMarkdown
  );
  const [isPrinting, setIsPrinting] = useState(false);
  const notesDefaultMode = user?.notesDefaultMode || "view";

  const [isEditing, setIsEditing] = useState(() => {
    if (note.encrypted) return false;
    const editor = searchParams?.get("editor");

    return notesDefaultMode === "edit" || editor === "true" ? true : false;
  });
  const [status, setStatus] = useState<{
    isSaving: boolean;
    isAutoSaving: boolean;
    saveState: NoteSaveState;
    lastSavedAt: number | null;
    error: string | null;
    hasQueuedSave: boolean;
  }>({
    isSaving: false,
    isAutoSaving: false,
    saveState: "idle",
    lastSavedAt: null as number | null,
    error: null as string | null,
    hasQueuedSave: false,
  });
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [showUnsavedChangesModal, setShowUnsavedChangesModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [isEditingEncrypted, setIsEditingEncrypted] = useState(false);
  const [contentIsDirty, setContentIsDirty] = useState(false);
  const decryptedPassphraseRef = useRef<string | null>(null);
  const decryptedMethodRef = useRef<string | null>(null);

  const cachePassphrase = useCallback((passphrase: string, method: string) => {
    decryptedPassphraseRef.current = passphrase;
    decryptedMethodRef.current = method;
  }, []);

  const clearPassphraseCache = useCallback(() => {
    decryptedPassphraseRef.current = null;
    decryptedMethodRef.current = null;
  }, []);

  const getCachedPassphrase = useCallback(() => decryptedPassphraseRef.current, []);
  const getCachedMethod = useCallback(() => decryptedMethodRef.current, []);

  useEffect(() => {
    clearPassphraseCache();
  }, [note?.uuid, clearPassphraseCache]);

  useEffect(() => {
    const _onVisibility = () => {
      if (document.visibilityState === "hidden") clearPassphraseCache();
    };
    document.addEventListener("visibilitychange", _onVisibility);
    return () => {
      document.removeEventListener("visibilitychange", _onVisibility);
      clearPassphraseCache();
    };
  }, [clearPassphraseCache]);

  const { autosaveNotes } = useSettings();
  const {
    registerNavigationGuard,
    unregisterNavigationGuard,
    executePendingNavigation,
  } = useNavigationGuard();
  const autosaveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const preserveEditModeOnNextNoteUpdateRef = useRef(false);
  const saveInProgressRef = useRef(false);
  const dirtyVersionRef = useRef(0);

  const markDirty = useCallback(() => {
    dirtyVersionRef.current += 1;
    setStatus((prev) => ({
      ...prev,
      saveState:
        prev.saveState === "saved" || prev.saveState === "error"
          ? "idle"
          : prev.saveState,
      error: null,
    }));
  }, []);

  const derivedMarkdownContent = useMemo(
    () =>
      isMarkdownMode
        ? processMarkdownContent(editorContent)
        : convertHtmlToMarkdownUnified(editorContent, user?.tableSyntax),
    [editorContent, isMarkdownMode, user?.tableSyntax]
  );

  useEffect(() => {
    const shouldPreserveEditMode =
      preserveEditModeOnNextNoteUpdateRef.current;
    preserveEditModeOnNextNoteUpdateRef.current = false;

    setTitleState(note.title);
    setCategoryState(note.category || "Uncategorized");
    setTagsState(normalizeTagList(note.tags));
    setContentIsDirty(false);
    setHasUnsavedChanges(false);
    setStatus((prev) => ({ ...prev, saveState: "idle", error: null }));
    dirtyVersionRef.current = 0;

    const { contentWithoutMetadata } = extractYamlMetadata(note.content || "");

    if (note.encrypted) {
      if (!shouldPreserveEditMode || !isEditingEncrypted) {
        setEditorContent(contentWithoutMetadata);
      }
      setIsMarkdownMode(true);
    } else if (isMinimalMode) {
      setEditorContent(contentWithoutMetadata);
      setIsMarkdownMode(true);
    } else if (defaultEditorIsMarkdown) {
      setEditorContent(contentWithoutMetadata);
      setIsMarkdownMode(true);
    } else {
      setEditorContent(convertMarkdownToHtml(contentWithoutMetadata));
      setIsMarkdownMode(false);
    }

    if (shouldPreserveEditMode) {
      setIsEditing(true);
      setHasUnsavedChanges(false);
      return;
    }

    if (searchParams?.get("editor") !== "true") {
      setIsEditing(false);
      setHasUnsavedChanges(false);
    }
  }, [note, isMinimalMode, defaultEditorIsMarkdown, isEditingEncrypted]);

  const editorActivity = useEditorActivityStore();

  useEffect(() => {
    if (isEditing) {
      editorActivity.register("note-editor");
    } else {
      editorActivity.unregister("note-editor");
    }
    return () => {
      editorActivity.unregister("note-editor");
    };
  }, [isEditing]);

  useEffect(() => {
    if (notesDefaultMode !== "edit" && !isEditing) return;
    const titleChanged = title !== note.title;
    const categoryChanged = category !== (note.category || "Uncategorized");
    const tagsChanged =
      normalizeTagList(tags).join("\0") !== normalizeTagList(note.tags).join("\0");
    setHasUnsavedChanges(
      contentIsDirty || titleChanged || categoryChanged || tagsChanged,
    );
  }, [contentIsDirty, title, category, tags, note, isEditing]);

  const handleSave = useCallback(
    async (
      shouldAutosave = false,
      passphrase?: string,
      options: NoteSaveOptions = {},
    ) => {
      if (saveInProgressRef.current) {
        setStatus((prev) => ({ ...prev, hasQueuedSave: true }));
        return false;
      }

      const effectivePassphrase =
        passphrase ?? decryptedPassphraseRef.current ?? undefined;
      if (isEditingEncrypted && !effectivePassphrase) {
        console.error("Cannot save encrypted note without passphrase");
        setStatus((prev) => ({
          ...prev,
          saveState: "error",
          error: t("notes.saveStatusError"),
        }));
        return false;
      }
      passphrase = effectivePassphrase;

      const useAutosave = shouldAutosave ? true : false;
      const exitEditMode = options.exitEditMode ?? false;
      const saveDirtyVersion = dirtyVersionRef.current;

      saveInProgressRef.current = true;
      setStatus((prev) => ({
        ...prev,
        isSaving: !useAutosave,
        isAutoSaving: useAutosave,
        saveState: useAutosave ? "auto-saving" : "saving",
        error: null,
        hasQueuedSave: false,
      }));

      const { contentWithoutMetadata: cleanContent } = extractYamlMetadata(
        derivedMarkdownContent
      );

      let contentToSave = cleanContent;

      try {
        if (isEditingEncrypted && passphrase && note.encryptionMethod) {
          const encryptFormData = new FormData();
          encryptFormData.append("content", cleanContent);
          encryptFormData.append("skipAuditLog", "true");

          if (note.encryptionMethod === "pgp") {
            encryptFormData.append("useStoredKey", "true");

            try {
              const signingData = JSON.parse(passphrase);
              if (signingData.signNote) {
                encryptFormData.append("signNote", "true");
                encryptFormData.append("useStoredSigningKey", signingData.useStoredSigningKey.toString());
                encryptFormData.append("signingPassphrase", signingData.signingPassphrase);
              }
            } catch (parseError) {
              await logAudit({
                level: "DEBUG",
                action: "note_saved_encrypted",
                category: "note",
                success: true,
                metadata: { message: t("encryption.pgpSaveWithoutSigning"), error: String(parseError) }
              });
            }

            const encryptResult = await encryptNoteContent(encryptFormData);
            if (encryptResult.success && encryptResult.data) {
              contentToSave = encryptResult.data.encryptedContent;
            } else {
              throw new Error(encryptResult.error || "Encryption failed");
            }
          } else if (note.encryptionMethod === "xchacha") {
            encryptFormData.append("passphrase", passphrase);
            const encryptResult = await encryptXChaCha(encryptFormData);
            if (encryptResult.success && encryptResult.data) {
              contentToSave = encryptResult.data.encryptedContent;
            } else {
              throw new Error(encryptResult.error || "Encryption failed");
            }
          }

          await logContentEvent(
            "note_saved_encrypted",
            "note",
            note.uuid!,
            title,
            true,
            { encryptionMethod: note.encryptionMethod }
          );
        }

        const formData = new FormData();
        formData.append("id", note.id);
        formData.append("title", useAutosave ? note.title : title);
        formData.append("content", contentToSave);
        formData.append("category", useAutosave ? (note.category || "Uncategorized") : (category.trim() || "Uncategorized"));
        formData.append("originalCategory", note.category || "Uncategorized");
        formData.append("user", note.owner || user?.username || "");
        formData.append("uuid", note.uuid || "");
        formData.append("tags", JSON.stringify(normalizeTagList(tags)));

        const result = await updateNote(formData, useAutosave);

        if (!result.success || !result.data) {
          throw new Error(result.error || "Failed to save note");
        }

        const titleChanged = title !== note.title;
        const categoryChanged = category !== (note.category || "Uncategorized");
        const tagsChanged =
          normalizeTagList(tags).join("\0") !== normalizeTagList(note.tags).join("\0");
        const autosaveHasUnsavedMetadata =
          useAutosave && (titleChanged || categoryChanged || tagsChanged);

        const hasNewerChanges = dirtyVersionRef.current !== saveDirtyVersion;

        if (!hasNewerChanges) {
          setContentIsDirty(false);
          if (!autosaveHasUnsavedMetadata) {
            setHasUnsavedChanges(false);
          }
        } else {
          setHasUnsavedChanges(true);
        }

        setStatus((prev) => ({
          ...prev,
          isSaving: false,
          isAutoSaving: false,
          saveState: "saved",
          lastSavedAt: Date.now(),
          error: null,
        }));

        if (useAutosave || hasNewerChanges) {
          return !hasNewerChanges;
        }

        preserveEditModeOnNextNoteUpdateRef.current = !exitEditMode;
        onUpdate(result.data);

        if (exitEditMode) {
          setIsEditing(false);
          setIsEditingEncrypted(false);
        } else {
          setIsEditing(true);
        }

        const categoryPath = buildCategoryPath(
          result.data.category || category || "Uncategorized",
          result.data.id
        );
        const notePath = `/note/${categoryPath}`;

        if (window.location.pathname !== notePath) {
          router.push(exitEditMode ? notePath : `${notePath}?editor=true`);
        } else if (!exitEditMode && searchParams?.get("editor") !== "true") {
          router.replace(`${notePath}?editor=true`, { scroll: false });
        } else {
          router.refresh();
        }

        return true;
      } catch (error) {
        console.error("Error saving note:", error);
        setStatus((prev) => ({
          ...prev,
          isSaving: false,
          isAutoSaving: false,
          saveState: "error",
          error: error instanceof Error ? error.message : t("notes.saveStatusError"),
        }));
        return false;
      } finally {
        saveInProgressRef.current = false;
        setStatus((prev) => ({
          ...prev,
          isSaving: false,
          isAutoSaving: false,
          hasQueuedSave: false,
        }));
      }
    },
    [
      note.id,
      note.owner,
      note.title,
      note.category,
      note.uuid,
      note.encryptionMethod,
      note.tags,
      title,
      derivedMarkdownContent,
      tags,
      category,
      onUpdate,
      router,
      searchParams,
      isEditingEncrypted,
      user?.username,
      t,
    ]
  );

  useEffect(() => {
    if (autosaveTimeoutRef.current) clearTimeout(autosaveTimeoutRef.current);
    const isEditMode = notesDefaultMode === "edit" || isEditing;
    const autosaveInterval = user?.notesAutoSaveInterval ?? 5000;

    if (
      autosaveInterval > 0 &&
      autosaveNotes &&
      isEditMode &&
      hasUnsavedChanges &&
      contentIsDirty &&
      !isEditingEncrypted
    ) {
      autosaveTimeoutRef.current = setTimeout(() => {
        void handleSave(true);
      }, autosaveInterval);
    }
    return () => {
      if (autosaveTimeoutRef.current) clearTimeout(autosaveTimeoutRef.current);
    };
  }, [
    autosaveNotes,
    isEditing,
    hasUnsavedChanges,
    contentIsDirty,
    handleSave,
    notesDefaultMode,
    user?.notesAutoSaveInterval,
    isEditingEncrypted,
  ]);

  useEffect(() => {
    const guard = () => {
      if (hasUnsavedChanges) {
        setShowUnsavedChangesModal(true);
        return false;
      }
      return true;
    };
    registerNavigationGuard(guard);
    return () => unregisterNavigationGuard();
  }, [hasUnsavedChanges, registerNavigationGuard, unregisterNavigationGuard]);

  const setTitle = useCallback((nextTitle: string) => {
    if (nextTitle !== title) markDirty();
    setTitleState(nextTitle);
  }, [markDirty, title]);

  const setCategory = useCallback((nextCategory: string) => {
    if (nextCategory !== category) markDirty();
    setCategoryState(nextCategory);
  }, [category, markDirty]);

  const setTags = useCallback((nextTags: string[]) => {
    const normalizedTags = normalizeTagList(nextTags);
    if (normalizedTags.join("\0") !== tags.join("\0")) markDirty();
    setTagsState(normalizedTags);
  }, [markDirty, tags]);

  const handleEditorContentChange = (content: string, isMarkdown: boolean, isDirty: boolean) => {
    if (isDirty) markDirty();
    setEditorContent(content);
    setIsMarkdownMode(isMarkdown);
    setContentIsDirty(isDirty);
  };

  const handleAddTag = (tag: string) => {
    const normalizedTag = normalizeTag(tag);
    setTags([...tags, normalizedTag]);
  };

  const handleRemoveTag = (tag: string) => {
    const normalizedTag = normalizeTag(tag);
    const nextTags = normalizeTagList(
      tags.filter((existingTag) => normalizeTag(existingTag) !== normalizedTag),
    );
    setTags(nextTags);
  };

  const handleEdit = () => setIsEditing(true);
  const handleCancel = () => {
    setIsEditing(false);
    setTitleState(note.title);
    setCategoryState(note.category || "Uncategorized");
    setTagsState(normalizeTagList(note.tags));
    setContentIsDirty(false);
    dirtyVersionRef.current = 0;
    const { contentWithoutMetadata } = extractYamlMetadata(note.content || "");
    if (isMinimalMode) {
      setEditorContent(contentWithoutMetadata);
      setIsMarkdownMode(true);
    } else if (defaultEditorIsMarkdown) {
      setEditorContent(contentWithoutMetadata);
      setIsMarkdownMode(true);
    } else {
      setEditorContent(convertMarkdownToHtml(contentWithoutMetadata));
      setIsMarkdownMode(false);
    }
  };

  const confirmDelete = async () => {
    const formData = new FormData();
    formData.append("id", note.id);
    formData.append("category", note.category || "");
    if (note.uuid) formData.append("uuid", note.uuid);
    await deleteNote(formData);
    onDelete?.(note.id);
    router.refresh();
    onBack();
    setShowDeleteModal(false);
  };

  const handleUnsavedChangesSave = () =>
    handleSave().then((saved) => {
      if (saved) executePendingNavigation();
    });
  const handleUnsavedChangesDiscard = () => executePendingNavigation();

  const handleEditEncrypted = useCallback(
    (passphrase: string, method: string, decryptedContent: string) => {
      cachePassphrase(passphrase, method);
      setIsEditingEncrypted(true);
      setEditorContent(decryptedContent);
      setIsEditing(true);
    },
    [note.uuid, note.title, cachePassphrase]
  );

  const handlePrint = () => {
    setIsPrinting(true);

    const categoryUrlPath =
      note.category && note.category !== "Uncategorized"
        ? encodeCategoryPath(note.category) + "/"
        : "";

    const printUrl = `/public/note/${categoryUrlPath}${encodeId(
      note.id
    )}?view_mode=print`;

    const iframe = document.createElement("iframe");
    iframe.style.position = "absolute";
    iframe.style.width = "0";
    iframe.style.height = "0";
    iframe.style.border = "none";

    const cleanup = () => {
      setTimeout(() => {
        if (document.body.contains(iframe)) {
          document.body.removeChild(iframe);
        }
        setIsPrinting(false);
      }, 100);
    };

    iframe.onload = () => {
      const win = iframe.contentWindow;
      if (!win) {
        console.error("Failed to get iframe content window.");
        cleanup();
        return;
      }

      const triggerPrint = () => {
        win.addEventListener("afterprint", cleanup);
        try {
          win.focus();
          win.print();
        } catch (e) {
          console.error("Failed to call print() on iframe:", e);
          cleanup();
        }
      };

      const checkReady = setInterval(() => {
        if ((win as any).printReady) {
          clearInterval(checkReady);
          clearTimeout(timeout);
          triggerPrint();
        }
      }, 100);

      const timeout = setTimeout(() => {
        clearInterval(checkReady);
        triggerPrint();
      }, 5000);
    };

    iframe.onerror = () => {
      console.error("Failed to load print iframe. Check URL:", printUrl);
      cleanup();
    };

    iframe.src = printUrl;
    document.body.appendChild(iframe);
  };

  return {
    title,
    setTitle,
    category,
    setCategory,
    tags,
    setTags,
    handleAddTag,
    handleRemoveTag,
    editorContent,
    setEditorContent,
    isEditing,
    setIsEditing,
    isEditMode: notesDefaultMode === "edit" || isEditing,
    status,
    hasUnsavedChanges,
    handleEdit,
    handleCancel,
    handleSave,
    handleDelete: () => setShowDeleteModal(true),
    handleEditorContentChange,
    derivedMarkdownContent,
    showUnsavedChangesModal,
    setShowUnsavedChangesModal,
    handleUnsavedChangesSave,
    handleUnsavedChangesDiscard,
    isMarkdownMode,
    setIsMarkdownMode,
    handlePrint,
    isPrinting,
    setIsPrinting,
    isEditingEncrypted,
    handleEditEncrypted,
    cachePassphrase,
    clearPassphraseCache,
    getCachedPassphrase,
    getCachedMethod,
    DeleteModal: () => (
      <ConfirmModal
        isOpen={showDeleteModal}
        onClose={() => setShowDeleteModal(false)}
        onConfirm={confirmDelete}
        title={t("common.delete")}
        message={t("common.confirmDeleteItem", { itemTitle: note.title })}
        confirmText={t("common.delete")}
        variant="destructive"
      />
    ),
  };
};
