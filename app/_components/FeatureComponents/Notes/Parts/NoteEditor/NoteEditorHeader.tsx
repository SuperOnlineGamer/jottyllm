"use client";

import { ShareModal } from "@/app/_components/GlobalComponents/Modals/SharingModals/ShareModal";
import { CategoryTreeSelector } from "@/app/_components/GlobalComponents/Dropdowns/CategoryTreeSelector";
import { Button } from "@/app/_components/GlobalComponents/Buttons/Button";
import {
  Archive02Icon,
  ArrowLeft01Icon,
  Tick02Icon,
  GridIcon,
  Globe02Icon,
  UserMultipleIcon,
  Folder02Icon,
  Orbit01Icon,
  FloppyDiskIcon,
  Share08Icon,
  Download01Icon,
  SidebarRightIcon,
  FileEditIcon,
  Delete03Icon,
  MoreHorizontalIcon,
  Copy01Icon,
  ViewIcon,
  LockKeyIcon,
  ViewOffSlashIcon,
  MessageLock02Icon,
  Cancel01Icon,
  Clock01Icon,
  GitCompareIcon,
  Copy02Icon,
} from "hugeicons-react";
import {
  Note,
  Category,
  NoteComment,
  NoteLinkedTaskPreview,
  NoteReminder,
} from "@/app/_types";
import { NoteEditorViewModel } from "@/app/_types";
import { useEffect, useState } from "react";
import { DropdownMenu } from "@/app/_components/GlobalComponents/Dropdowns/DropdownMenu";
import { Input } from "@/app/_components/GlobalComponents/FormElements/Input";
import { Textarea } from "@/app/_components/GlobalComponents/FormElements/Textarea";
import { useRouter } from "next/navigation";
import { useAppMode } from "@/app/_providers/AppModeProvider";
import { toggleArchive } from "@/app/_server/actions/dashboard";
import { Modes } from "@/app/_types/enums";
import {
  copyTextToClipboard,
  encodeCategoryPath,
  buildCategoryPath,
  cn,
} from "@/app/_utils/global-utils";
import { sharingInfo } from "@/app/_utils/sharing-utils";
import { usePermissions } from "@/app/_providers/PermissionsProvider";
import { SharedWithModal } from "@/app/_components/GlobalComponents/Modals/SharingModals/SharedWithModal";
import { useMetadata } from "@/app/_providers/MetadataProvider";
import { PGPEncryptionModal } from "@/app/_components/GlobalComponents/Modals/EncryptionModals/PGPEncryptionModal";
import { XChaChaEncryptionModal } from "@/app/_components/GlobalComponents/Modals/EncryptionModals/XChaChaEncryptionModal";
import { updateNote } from "@/app/_server/actions/note";
import { Logo } from "@/app/_components/GlobalComponents/Layout/Logo/Logo";
import {
  detectEncryptionMethod,
  isEncrypted,
} from "@/app/_utils/encryption-utils";
import { useTranslations } from "next-intl";
import { NoteHistoryModal } from "@/app/_components/GlobalComponents/Modals/NotesModal/NoteHistoryModal";
import { useToast } from "@/app/_providers/ToastProvider";
import { NoteTagEditor } from "@/app/_components/FeatureComponents/Tags/TagChip";
import {
  addNoteComment,
  deleteNoteReminder,
  getNoteLinkedTaskPreviews,
  resolveNoteComment,
  upsertNoteReminder,
} from "@/app/_server/actions/note-workflows";

interface NoteEditorHeaderProps {
  note: Note;
  categories: Category[];
  isOwner: boolean;
  onBack: () => void;
  onClone?: () => void;
  showTOC: boolean;
  setShowTOC: (show: boolean) => void;
  viewModel: NoteEditorViewModel;
  onOpenDecryptModal?: React.MutableRefObject<(() => void) | null>;
  onOpenViewModal?: React.MutableRefObject<(() => void) | null>;
}

type WorkflowPanel = "reminders" | "comments" | "linkedTasks";

const localDateTimeToIso = (value: string): string => {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "" : date.toISOString();
};

const formatWorkflowDateTime = (value: string): string => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;

  return date.toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  });
};

export const NoteEditorHeader = ({
  note,
  categories,
  isOwner,
  onBack,
  onClone,
  viewModel,
  showTOC,
  setShowTOC,
  onOpenDecryptModal,
  onOpenViewModal,
}: NoteEditorHeaderProps) => {
  const t = useTranslations();
  const metadata = useMetadata();
  const {
    title,
    setTitle,
    category,
    isEditing,
    status,
    handleEdit,
    handleCancel,
    handleSave,
    handleDelete,
    isPrinting,
    isEditingEncrypted,
  } = viewModel;
  const [showShareModal, setShowShareModal] = useState(false);
  const [showSharedWithModal, setShowSharedWithModal] = useState(false);
  const [showEncryptionModal, setShowEncryptionModal] = useState(false);
  const [encryptionModalMode, setEncryptionModalMode] = useState<
    "encrypt" | "decrypt" | "view" | "edit" | "save"
  >("encrypt");
  const [hasPromptedForDecryption, setHasPromptedForDecryption] =
    useState(false);
  const [copied, setCopied] = useState(false);
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [activeWorkflowPanel, setActiveWorkflowPanel] =
    useState<WorkflowPanel | null>(null);
  const [reminders, setReminders] = useState<NoteReminder[]>(note.reminders || []);
  const [comments, setComments] = useState<NoteComment[]>(note.comments || []);
  const [linkedTaskPreviews, setLinkedTaskPreviews] = useState<
    NoteLinkedTaskPreview[]
  >((note.linkedTasks || []).map((linkedTask) => ({ ...linkedTask, exists: false })));
  const [reminderTitle, setReminderTitle] = useState("");
  const [reminderDueAt, setReminderDueAt] = useState("");
  const [commentBody, setCommentBody] = useState("");
  const [isSavingWorkflow, setIsSavingWorkflow] = useState(false);
  const [isLoadingLinkedTasks, setIsLoadingLinkedTasks] = useState(false);
  const { user, appSettings } = useAppMode();
  const router = useRouter();
  const { permissions } = usePermissions();
  const { showToast } = useToast();

  useEffect(() => {
    setHasPromptedForDecryption(false);
  }, [note?.id]);

  useEffect(() => {
    setReminders(note.reminders || []);
    setComments(note.comments || []);
    setLinkedTaskPreviews(
      (note.linkedTasks || []).map((linkedTask) => ({
        ...linkedTask,
        exists: false,
      })),
    );
    setActiveWorkflowPanel(null);
  }, [note?.id, note.reminders, note.comments]);

  useEffect(() => {
    const linkedTasks = note.linkedTasks || [];
    if (linkedTasks.length === 0) {
      setLinkedTaskPreviews([]);
      return;
    }

    let isActive = true;
    const loadLinkedTaskPreviews = async () => {
      setIsLoadingLinkedTasks(true);
      try {
        const formData = new FormData();
        formData.append("noteId", note.uuid || note.id);
        formData.append("noteCategory", note.category || "Uncategorized");
        const result = await getNoteLinkedTaskPreviews(formData);

        if (isActive && result.success && result.data) {
          setLinkedTaskPreviews(result.data);
        }
      } catch (error) {
        console.error("Failed to load linked task previews:", error);
      } finally {
        if (isActive) setIsLoadingLinkedTasks(false);
      }
    };

    loadLinkedTaskPreviews();

    return () => {
      isActive = false;
    };
  }, [note.id, note.uuid, note.category, note.linkedTasks]);

  useEffect(() => {
    if (onOpenDecryptModal) {
      onOpenDecryptModal.current = () => {
        setEncryptionModalMode("decrypt");
        setShowEncryptionModal(true);
      };
    }
    if (onOpenViewModal) {
      onOpenViewModal.current = () => {
        setEncryptionModalMode("view");
        setShowEncryptionModal(true);
      };
    }
  }, [onOpenDecryptModal, onOpenViewModal]);

  useEffect(() => {
    if (
      note?.encrypted &&
      user?.encryptionSettings?.autoDecrypt &&
      !hasPromptedForDecryption &&
      !isEditing
    ) {
      setEncryptionModalMode("view");
      setShowEncryptionModal(true);
      setHasPromptedForDecryption(true);
    }
  }, [
    note?.encrypted,
    user?.encryptionSettings?.autoDecrypt,
    hasPromptedForDecryption,
    isEditing,
  ]);

  const buildWorkflowFormData = () => {
    const formData = new FormData();
    formData.append("noteId", note.uuid || note.id);
    formData.append("noteCategory", note.category || "Uncategorized");
    return formData;
  };

  const toggleWorkflowPanel = (panel: WorkflowPanel) => {
    setActiveWorkflowPanel((current) => (current === panel ? null : panel));
  };

  const handleAddReminder = async () => {
    if (!permissions?.canEdit) return;
    const dueAtIso = localDateTimeToIso(reminderDueAt);
    if (!dueAtIso) {
      showToast({
        type: "error",
        title: t("common.error"),
        message: "Choose a valid reminder date and time.",
      });
      return;
    }

    setIsSavingWorkflow(true);
    try {
      const formData = buildWorkflowFormData();
      formData.append("dueAt", dueAtIso);
      formData.append(
        "timezoneOffsetMinutes",
        String(new Date(reminderDueAt).getTimezoneOffset()),
      );
      formData.append("title", reminderTitle.trim());
      formData.append("notify", "true");

      const result = await upsertNoteReminder(formData);
      if (!result.success || !result.data) {
        throw new Error(result.error || "Failed to save reminder.");
      }

      setReminders(result.data.note.reminders || []);
      setReminderTitle("");
      setReminderDueAt("");
      showToast({
        type: "success",
        title: t("common.success"),
        message: "Reminder added.",
      });
      router.refresh();
    } catch (error) {
      showToast({
        type: "error",
        title: t("common.error"),
        message: error instanceof Error ? error.message : "Failed to save reminder.",
      });
    } finally {
      setIsSavingWorkflow(false);
    }
  };

  const handleDeleteReminder = async (reminderId: string) => {
    if (!permissions?.canEdit) return;

    setIsSavingWorkflow(true);
    try {
      const formData = buildWorkflowFormData();
      formData.append("reminderId", reminderId);
      const result = await deleteNoteReminder(formData);
      if (!result.success || !result.data) {
        throw new Error(result.error || "Failed to delete reminder.");
      }
      setReminders(result.data.note.reminders || []);
      router.refresh();
    } catch (error) {
      showToast({
        type: "error",
        title: t("common.error"),
        message: error instanceof Error ? error.message : "Failed to delete reminder.",
      });
    } finally {
      setIsSavingWorkflow(false);
    }
  };

  const handleAddComment = async () => {
    if (!permissions?.canEdit) return;
    if (!commentBody.trim()) return;

    setIsSavingWorkflow(true);
    try {
      const formData = buildWorkflowFormData();
      formData.append("body", commentBody.trim());
      const result = await addNoteComment(formData);
      if (!result.success || !result.data) {
        throw new Error(result.error || "Failed to add comment.");
      }
      setComments(result.data.note.comments || []);
      setCommentBody("");
      router.refresh();
    } catch (error) {
      showToast({
        type: "error",
        title: t("common.error"),
        message: error instanceof Error ? error.message : "Failed to add comment.",
      });
    } finally {
      setIsSavingWorkflow(false);
    }
  };

  const handleResolveComment = async (commentId: string) => {
    if (!permissions?.canEdit) return;

    setIsSavingWorkflow(true);
    try {
      const formData = buildWorkflowFormData();
      formData.append("commentId", commentId);
      const result = await resolveNoteComment(formData);
      if (!result.success || !result.data) {
        throw new Error(result.error || "Failed to resolve comment.");
      }
      setComments(result.data.note.comments || []);
      router.refresh();
    } catch (error) {
      showToast({
        type: "error",
        title: t("common.error"),
        message: error instanceof Error ? error.message : "Failed to resolve comment.",
      });
    } finally {
      setIsSavingWorkflow(false);
    }
  };

  const handleArchive = async () => {
    const result = await toggleArchive(note, Modes.NOTES);
    if (result.success) {
      router.refresh();
    }
  };

  const handleHistoryClick = () => {
    setShowHistoryModal(true);
  };

  const handleCopyId = async () => {
    const success = await copyTextToClipboard(
      `${note?.uuid
        ? note?.uuid
        : `${encodeCategoryPath(note?.category || "Uncategorized")}/${note?.id
        }`
      }`
    );
    if (success) {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleViewDecryption = (
    decryptedContent: string,
    passphrase?: string,
    method?: string
  ) => {
    if (passphrase && method) {
      viewModel.cachePassphrase(passphrase, method);
    }
    viewModel.handleEditorContentChange(decryptedContent, true, false);
    setShowEncryptionModal(false);
  };

  const handleEditEncrypted = (
    decryptedContent: string,
    passphrase?: string,
    method?: string
  ) => {
    if (passphrase && method) {
      viewModel.handleEditEncrypted(passphrase, method, decryptedContent);
      setShowEncryptionModal(false);
    }
  };

  const handleSaveEncrypted = (
    decryptedContent: string,
    passphrase?: string,
    method?: string
  ) => {
    const saveParam = method === "pgp" ? decryptedContent : passphrase;
    if (saveParam || method === "pgp") {
      if (method === "xchacha" && passphrase) {
        viewModel.cachePassphrase(passphrase, method);
      }
      handleSave(false, saveParam);
      setShowEncryptionModal(false);
    }
  };

  const handlePermanentDecryption = async (newContent: string) => {
    const formData = new FormData();
    formData.append("id", note.id);
    formData.append("title", title);
    formData.append("content", newContent);
    formData.append("category", category);
    formData.append("originalCategory", note.category || "Uncategorized");
    if (note.uuid) {
      formData.append("uuid", note.uuid);
    }

    const result = await updateNote(formData);

    if (result.success && result.data) {
      const categoryPath = buildCategoryPath(
        result.data.category || t("notes.uncategorized"),
        result.data.id
      );
      const newPath = `/note/${categoryPath}`;
      const currentPath = window.location.pathname;

      if (newPath === currentPath) {
        window.location.reload();
      } else {
        router.push(newPath);
      }
    }
  };

  const handleEncryptionSuccess = async (newContent: string) => {
    const formData = new FormData();
    formData.append("id", note.id);
    formData.append("title", title);
    formData.append("content", newContent);
    formData.append("category", category);
    formData.append("originalCategory", note.category || "Uncategorized");
    if (note.uuid) {
      formData.append("uuid", note.uuid);
    }

    const result = await updateNote(formData);

    if (result.success && result.data) {
      const categoryPath = buildCategoryPath(
        result.data.category || t("notes.uncategorized"),
        result.data.id
      );
      const newPath = `/note/${categoryPath}`;
      const currentPath = window.location.pathname;

      if (newPath === currentPath) {
        window.location.reload();
      } else {
        router.push(newPath);
      }
    }
  };

  const { globalSharing } = useAppMode();
  const encodedCategory = encodeCategoryPath(metadata.category);
  const itemDetails = sharingInfo(
    globalSharing,
    metadata.uuid || metadata.id,
    encodedCategory
  );
  const isShared = itemDetails.exists && itemDetails.sharedWith.length > 0;
  const sharedWith = itemDetails.sharedWith;
  const isPubliclyShared = itemDetails.isPublic;

  const canDelete = permissions?.canDelete;

  const isContentStillEncrypted = isEncrypted(viewModel.editorContent || "");
  const isInViewMode = note?.encrypted && !isContentStillEncrypted;
  const shouldShowSaveStatus =
    isEditing || (user?.notesDefaultMode === "edit" && permissions?.canEdit);
  const saveIndicator = (() => {
    if (!shouldShowSaveStatus) return null;

    if (status.isSaving) {
      return {
        label: t("common.saving"),
        icon: <Clock01Icon className="h-3.5 w-3.5 animate-pulse" />,
        className: "text-muted-foreground",
        title: t("common.saving"),
      };
    }

    if (status.isAutoSaving) {
      return {
        label: t("notes.saveStatusAutosaving"),
        icon: <Clock01Icon className="h-3.5 w-3.5 animate-pulse" />,
        className: "text-muted-foreground",
        title: t("notes.saveStatusAutosaving"),
      };
    }

    if (status.saveState === "error") {
      return {
        label: t("notes.saveStatusError"),
        icon: <Cancel01Icon className="h-3.5 w-3.5" />,
        className: "text-destructive",
        title: status.error || t("notes.saveStatusError"),
      };
    }

    if (viewModel.hasUnsavedChanges) {
      return {
        label: t("notes.saveStatusUnsaved"),
        icon: <Clock01Icon className="h-3.5 w-3.5" />,
        className: "text-muted-foreground",
        title: t("notes.saveStatusUnsaved"),
      };
    }

    if (status.saveState === "saved") {
      return {
        label: t("notes.saveStatusSaved"),
        icon: <Tick02Icon className="h-3.5 w-3.5" />,
        className: "text-green-600 dark:text-green-400",
        title: t("notes.saveStatusSaved"),
      };
    }

    return null;
  })();
  const shouldShowTagEditor =
    appSettings?.editor?.enableTags !== false &&
    (isEditing || viewModel.tags.length > 0);
  const pendingReminders = reminders.filter(
    (reminder) => reminder.status === "pending",
  );
  const openComments = comments.filter((comment) => !comment.resolvedAt);
  const linkedTaskCount = note.linkedTasks?.length || linkedTaskPreviews.length;
  const activeLinkedTaskCount = linkedTaskPreviews.filter(
    (task) => task.exists && !task.completed && !task.itemArchived,
  ).length;
  const shouldShowWorkflowSummary =
    permissions?.canEdit ||
    pendingReminders.length > 0 ||
    openComments.length > 0 ||
    linkedTaskCount > 0;

  return (
    <>
      <div
        className={`bg-background border-b border-border px-4 ${isEditing ? "py-[11px]" : "py-3"
          } sticky top-0 z-20 no-print`}
      >
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 flex-1 min-w-0 transition-all duration-100">
            <Button
              variant="ghost"
              size="icon"
              onClick={onBack}
              className="h-8 w-8 flex-shrink-0"
              aria-label={t("common.back")}
            >
              <ArrowLeft01Icon className="h-5 w-5" />
            </Button>
            <div className="flex-1 min-w-0">
              {isEditing ? (
                <Input
                  id="noteTitle"
                  name="noteTitle"
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder={t("checklists.noteTitle")}
                  className="!space-y-0 [&>label]:hidden [&>input]:text-xl [&>input]:font-bold [&>input]:bg-transparent [&>input]:border-none [&>input]:p-0 [&>input]:focus:ring-0"
                />
              ) : (
                <div>
                  <div className="flex items-center gap-2">
                    <h1 className="text-xl font-bold truncate">{title}</h1>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        handleCopyId();
                      }}
                      className="h-6 w-6 p-0"
                      title={`Copy ID: ${note?.uuid
                        ? note?.uuid
                        : `${encodeCategoryPath(
                          note?.category || t("notes.uncategorized")
                        )}/${note?.id}`
                        }`}
                    >
                      {copied ? (
                        <Tick02Icon className="h-3 w-3 text-green-500" />
                      ) : (
                        <GridIcon className="h-3 w-3" />
                      )}
                    </Button>

                    {note?.encrypted && (
                      <LockKeyIcon className="h-4 w-4 text-primary flex-shrink-0" />
                    )}
                    {isPubliclyShared && (
                      <span title={t("notes.publiclySharedNote")}>
                        <Globe02Icon className="h-4 w-4 text-primary" />
                      </span>
                    )}
                    {isShared && (
                      <span
                        title={`Shared with ${sharedWith.join(", ")}`}
                        className="cursor-pointer hover:text-primary"
                        onClick={() => setShowSharedWithModal(true)}
                      >
                        <UserMultipleIcon className="h-3 w-3" />
                      </span>
                    )}
                  </div>
                  {category && category !== t("notes.uncategorized") && (
                    <div className="flex items-center gap-1.5 mt-1 text-md lg:text-sm text-muted-foreground">
                      <Folder02Icon className="h-3 w-3" />
                      <span>{category}</span>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            {isEditing ? (
              <>
                {isOwner && (
                  <div className="lg:w-[400px]">
                    <CategoryTreeSelector
                      categories={categories}
                      selectedCategory={category}
                      onCategorySelect={viewModel.setCategory}
                      placeholder={t("common.selectCategory")}
                      className="note-mobile-category-tree"
                    />
                  </div>
                )}

                <Button
                  variant="outline"
                  className="hidden lg:flex"
                  size="sm"
                  onClick={handleCancel}
                >
                  {t("common.cancel")}
                </Button>
                <Button
                  size="sm"
                  onClick={() => {
                    if (isEditingEncrypted) {
                      const cached = viewModel.getCachedPassphrase();
                      if (cached) {
                        handleSave(false, cached);
                      } else {
                        setEncryptionModalMode("save");
                        setShowEncryptionModal(true);
                      }
                    } else {
                      handleSave();
                    }
                  }}
                  className="hidden lg:flex"
                  disabled={status.isSaving || status.isAutoSaving}
                >
                  {status.isSaving ? (
                    <>
                      <Logo
                        className="h-4 w-4 bg-background mr-2 animate-pulse"
                        pathClassName="fill-primary"
                      />
                      <span>{t("common.saving")}</span>
                    </>
                  ) : (
                    <>
                      <FloppyDiskIcon className="h-4 w-4 mr-2" />
                      <span>{t("common.save")}</span>
                    </>
                  )}
                </Button>

                <div
                  className={`fixed bottom-[20px] ${user?.handedness === "left-handed"
                    ? "left-[2.5%]"
                    : "right-[2.5%]"
                    } lg:hidden z-50 flex flex-col gap-1 bg-background border border-border rounded-jotty p-1`}
                >
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={handleCancel}
                    aria-label={t("common.cancel")}
                  >
                    <Cancel01Icon className="h-5 w-5" />
                  </Button>

                  <Button
                    size="icon"
                    onClick={() => {
                      if (isEditingEncrypted) {
                        setEncryptionModalMode("save");
                        setShowEncryptionModal(true);
                      } else {
                        handleSave();
                      }
                    }}
                    className="h-10 w-10"
                    disabled={status.isSaving || status.isAutoSaving}
                    aria-label={
                      status.isSaving ? t("common.saving") : t("common.save")
                    }
                  >
                    {status.isSaving ? (
                      <Logo
                        className="h-5 w-5 bg-background animate-pulse"
                        pathClassName="fill-primary-foreground"
                      />
                    ) : (
                      <FloppyDiskIcon className="h-5 w-5" />
                    )}
                  </Button>
                </div>
              </>
            ) : (
              <>
                <div className="flex items-center gap-2">
                  {user?.notesDefaultMode === "edit" &&
                    permissions?.canEdit &&
                    !note?.encrypted && (
                      <Button
                        variant="outline"
                        size="icon"
                        onClick={() => handleSave()}
                        aria-label={t("notes.quickSave")}
                        className="text-primary hover:text-primary/80"
                      >
                        {status.isSaving ? (
                          <>
                            <Logo
                              className="h-5 w-5 bg-background mr-2 animate-pulse"
                              pathClassName="fill-primary"
                            />
                          </>
                        ) : (
                          <>
                            <FloppyDiskIcon className="h-5 w-5" />
                          </>
                        )}
                      </Button>
                    )}

                  {permissions?.canEdit && (
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={() => {
                        if (note?.encrypted) {
                          const cached = viewModel.getCachedPassphrase();
                          const cachedMethod = viewModel.getCachedMethod();
                          const alreadyDecrypted = !isEncrypted(viewModel.editorContent || "");
                          if (cached && cachedMethod && alreadyDecrypted) {
                            viewModel.handleEditEncrypted(cached, cachedMethod, viewModel.editorContent);
                          } else {
                            setEncryptionModalMode("edit");
                            setShowEncryptionModal(true);
                          }
                        } else {
                          handleEdit();
                        }
                      }}
                      aria-label={
                        note?.encrypted
                          ? t("encryption.editEncrypted")
                          : t("common.edit")
                      }
                    >
                      {note?.encrypted ? (
                        <MessageLock02Icon className="h-5 w-5" />
                      ) : (
                        <FileEditIcon className="h-5 w-5" />
                      )}
                    </Button>
                  )}
                  <DropdownMenu
                    align="right"
                    trigger={
                      <Button
                        variant="outline"
                        size="icon"
                        aria-label={t("common.moreOptions")}
                      >
                        <MoreHorizontalIcon className="h-5 w-5" />
                      </Button>
                    }
                    items={[
                      ...(permissions?.isOwner
                        ? [
                          {
                            type: "item" as const,
                            label: t("sharing.share"),
                            icon: <Share08Icon className="h-4 w-4" />,
                            onClick: () => setShowShareModal(true),
                          },
                        ]
                        : []),
                      ...(onClone
                        ? [
                          {
                            type: "item" as const,
                            label: t("common.clone"),
                            icon: <Copy02Icon className="h-4 w-4" />,
                            onClick: onClone,
                          },
                        ]
                        : []),
                      ...(note?.encrypted
                        ? [
                          {
                            type: "item" as const,
                            label: !isInViewMode
                              ? t("settings.view")
                              : t("common.hide"),
                            icon: !isInViewMode ? (
                              <ViewIcon className="h-4 w-4" />
                            ) : (
                              <ViewOffSlashIcon className="h-4 w-4" />
                            ),
                            onClick: () => {
                              if (!isInViewMode) {
                                setEncryptionModalMode("view");
                                setShowEncryptionModal(true);
                              } else {
                                window.location.reload();
                              }
                            },
                          },
                          ...(!isInViewMode && permissions?.canEdit
                            ? [
                              {
                                type: "item" as const,
                                label: t("encryption.decrypt"),
                                icon: <LockKeyIcon className="h-4 w-4" />,
                                onClick: () => {
                                  setEncryptionModalMode("decrypt");
                                  setShowEncryptionModal(true);
                                },
                              },
                            ]
                            : []),
                        ]
                        : [
                          ...(permissions?.canEdit
                            ? [
                              {
                                type: "item" as const,
                                label: t("encryption.encryptNote"),
                                icon: <LockKeyIcon className="h-4 w-4" />,
                                onClick: () => {
                                  setEncryptionModalMode("encrypt");
                                  setShowEncryptionModal(true);
                                },
                              },
                            ]
                            : []),
                        ]),
                      {
                        type: "item" as const,
                        label: t("notes.copyRawContent"),
                        icon: <Copy01Icon className="h-4 w-4" />,
                        onClick: async () => {
                          const success = await copyTextToClipboard(viewModel.derivedMarkdownContent);
                          if (success) {
                            showToast({
                              title: t("common.copiedToClipboard"),
                              type: "success",
                            });
                          }
                        },
                      },
                      {
                        type: "item" as const,
                        label: t("notes.printSaveAsPdf"),
                        icon: isPrinting ? (
                          <Orbit01Icon className="h-4 w-4 animate-spin" />
                        ) : (
                          <Download01Icon className="h-4 w-4" />
                        ),
                        onClick: viewModel.handlePrint,
                      },
                      ...(!note?.encrypted
                        ? [
                          {
                            type: "item" as const,
                            label: t("common.history"),
                            icon: <GitCompareIcon className="h-4 w-4" />,
                            onClick: handleHistoryClick,
                          },
                        ]
                        : []),
                      {
                        type: "item" as const,
                        label: t("notes.tableOfContents"),
                        icon: <SidebarRightIcon className="h-4 w-4" />,
                        onClick: () => setShowTOC(!showTOC),
                        className: "hidden lg:flex",
                      },
                      ...(permissions?.canDelete
                        ? [
                          {
                            type: "item" as const,
                            label: t("profile.archiveTab"),
                            icon: <Archive02Icon className="h-4 w-4" />,
                            onClick: handleArchive,
                          },
                        ]
                        : []),
                      ...(canDelete
                        ? [
                          {
                            type: "item" as const,
                            label: t("common.delete"),
                            icon: <Delete03Icon className="h-4 w-4" />,
                            onClick: handleDelete,
                            variant: "destructive" as const,
                          },
                        ]
                        : []),
                    ]}
                  />
                </div>
              </>
            )}
          </div>
        </div>
        {(shouldShowTagEditor || saveIndicator) && (
          <div className="mt-2 flex flex-col gap-2 pl-11 pr-1 lg:flex-row lg:items-center lg:justify-between">
            {shouldShowTagEditor ? (
              <NoteTagEditor
                tags={viewModel.tags}
                isEditing={isEditing && (!note?.encrypted || isEditingEncrypted)}
                onAddTag={viewModel.handleAddTag}
                onRemoveTag={viewModel.handleRemoveTag}
                className="flex-1"
                disabled={status.isSaving || status.isAutoSaving}
              />
            ) : (
              <div />
            )}
            {saveIndicator && (
              <div
                className={cn(
                  "flex shrink-0 items-center gap-1.5 text-xs font-medium",
                  saveIndicator.className,
                )}
                title={saveIndicator.title}
                aria-live="polite"
              >
                {saveIndicator.icon}
                <span>{saveIndicator.label}</span>
              </div>
            )}
          </div>
        )}
        {shouldShowWorkflowSummary && (
          <div className="mt-2 pl-11 pr-1">
            <div className="flex flex-wrap items-center gap-2">
              <Button
                type="button"
                variant={activeWorkflowPanel === "reminders" ? "secondary" : "ghost"}
                size="sm"
                onClick={() => toggleWorkflowPanel("reminders")}
                className="gap-1.5"
              >
                <Clock01Icon className="h-4 w-4" />
                <span>Reminders</span>
                {pendingReminders.length > 0 && (
                  <span className="rounded-full bg-primary/10 px-1.5 py-0.5 text-xs text-primary">
                    {pendingReminders.length}
                  </span>
                )}
              </Button>
              <Button
                type="button"
                variant={activeWorkflowPanel === "comments" ? "secondary" : "ghost"}
                size="sm"
                onClick={() => toggleWorkflowPanel("comments")}
                className="gap-1.5"
              >
                <MessageLock02Icon className="h-4 w-4" />
                <span>Comments</span>
                {openComments.length > 0 && (
                  <span className="rounded-full bg-primary/10 px-1.5 py-0.5 text-xs text-primary">
                    {openComments.length}
                  </span>
                )}
              </Button>
              {linkedTaskCount > 0 && (
                <Button
                  type="button"
                  variant={activeWorkflowPanel === "linkedTasks" ? "secondary" : "ghost"}
                  size="sm"
                  onClick={() => toggleWorkflowPanel("linkedTasks")}
                  className="gap-1.5"
                >
                  <Tick02Icon className="h-4 w-4" />
                  <span>Tasks</span>
                  <span className="rounded-full bg-primary/10 px-1.5 py-0.5 text-xs text-primary">
                    {activeLinkedTaskCount || linkedTaskCount}
                  </span>
                </Button>
              )}
            </div>

            {activeWorkflowPanel && (
              <div className="mt-3 rounded-jotty border border-border bg-muted/20 p-4">
                <div
                  className={cn(
                    "space-y-3",
                    activeWorkflowPanel !== "reminders" && "hidden",
                  )}
                >
                  <div>
                    <h3 className="text-md lg:text-sm font-semibold text-foreground">
                      Reminders
                    </h3>
                    <p className="text-sm lg:text-xs text-muted-foreground">
                      Attach a due date to this note.
                    </p>
                  </div>
                  {permissions?.canEdit && (
                    <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_minmax(180px,220px)_auto] sm:items-end">
                      <Input
                        id="note-reminder-title"
                        type="text"
                        label="Title"
                        value={reminderTitle}
                        onChange={(event) => setReminderTitle(event.target.value)}
                        placeholder="Follow up"
                        disabled={isSavingWorkflow}
                      />
                      <Input
                        id="note-reminder-due-at"
                        type="datetime-local"
                        label="Due"
                        value={reminderDueAt}
                        onChange={(event) => setReminderDueAt(event.target.value)}
                        disabled={isSavingWorkflow}
                      />
                      <Button
                        type="button"
                        size="sm"
                        onClick={handleAddReminder}
                        disabled={isSavingWorkflow || !reminderDueAt}
                      >
                        Add
                      </Button>
                    </div>
                  )}
                  <div className="space-y-2">
                    {reminders.length > 0 ? (
                      reminders.map((reminder) => (
                        <div
                          key={reminder.id}
                          className="flex items-center justify-between gap-3 rounded-jotty border border-border bg-background px-3 py-2"
                        >
                          <div className="min-w-0">
                            <p className="truncate text-md lg:text-sm font-medium">
                              {reminder.title || "Untitled reminder"}
                            </p>
                            <p className="text-sm lg:text-xs text-muted-foreground">
                              {formatWorkflowDateTime(reminder.dueAt)} · {reminder.status}
                            </p>
                          </div>
                          {permissions?.canEdit && (
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              onClick={() => handleDeleteReminder(reminder.id)}
                              disabled={isSavingWorkflow}
                              title="Delete reminder"
                            >
                              <Delete03Icon className="h-4 w-4" />
                            </Button>
                          )}
                        </div>
                      ))
                    ) : (
                      <p className="text-md lg:text-sm text-muted-foreground">
                        No reminders yet.
                      </p>
                    )}
                  </div>
                </div>

                <div
                  className={cn(
                    "space-y-3",
                    activeWorkflowPanel !== "comments" && "hidden",
                  )}
                >
                  <div>
                    <h3 className="text-md lg:text-sm font-semibold text-foreground">
                      Comments
                    </h3>
                    <p className="text-sm lg:text-xs text-muted-foreground">
                      Leave a note for collaborators or future review.
                    </p>
                  </div>
                  {permissions?.canEdit && (
                    <div className="space-y-2">
                      <Textarea
                        id="note-comment-body"
                        label="New comment"
                        value={commentBody}
                        onChange={(event) => setCommentBody(event.target.value)}
                        rows={3}
                        minHeight="90px"
                        disabled={isSavingWorkflow}
                      />
                      <div className="flex justify-end">
                        <Button
                          type="button"
                          size="sm"
                          onClick={handleAddComment}
                          disabled={isSavingWorkflow || !commentBody.trim()}
                        >
                          Add comment
                        </Button>
                      </div>
                    </div>
                  )}
                  <div className="space-y-2">
                    {comments.length > 0 ? (
                      comments.map((comment) => (
                        <div
                          key={comment.id}
                          className={cn(
                            "rounded-jotty border border-border bg-background px-3 py-2",
                            comment.resolvedAt && "opacity-60",
                          )}
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0 space-y-1">
                              <p className="whitespace-pre-wrap text-md lg:text-sm">
                                {comment.body}
                              </p>
                              <p className="text-sm lg:text-xs text-muted-foreground">
                                {comment.author} · {formatWorkflowDateTime(comment.createdAt)}
                                {comment.resolvedAt ? " · Resolved" : ""}
                              </p>
                            </div>
                            {permissions?.canEdit && !comment.resolvedAt && (
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                onClick={() => handleResolveComment(comment.id)}
                                disabled={isSavingWorkflow}
                                title="Resolve comment"
                              >
                                <Tick02Icon className="h-4 w-4" />
                              </Button>
                            )}
                          </div>
                        </div>
                      ))
                    ) : (
                      <p className="text-md lg:text-sm text-muted-foreground">
                        No comments yet.
                      </p>
                    )}
                  </div>
                </div>

                <div
                  className={cn(
                    "space-y-3",
                    activeWorkflowPanel !== "linkedTasks" && "hidden",
                  )}
                >
                  <div>
                    <h3 className="text-md lg:text-sm font-semibold text-foreground">
                      Linked tasks
                    </h3>
                    <p className="text-sm lg:text-xs text-muted-foreground">
                      Track checklist items created from this note.
                    </p>
                  </div>
                  <div className="space-y-2">
                    {isLoadingLinkedTasks ? (
                      <p className="text-md lg:text-sm text-muted-foreground">
                        Loading linked tasks...
                      </p>
                    ) : linkedTaskPreviews.length > 0 ? (
                      linkedTaskPreviews.map((task) => {
                        const statusLabel = !task.exists
                          ? "Missing"
                          : task.completed
                            ? "Completed"
                            : task.statusLabel || "Open";
                        const statusClassName = !task.exists
                          ? "bg-destructive/10 text-destructive"
                          : task.completed
                            ? "bg-green-500/10 text-green-600 dark:text-green-400"
                            : "bg-primary/10 text-primary";

                        return (
                          <button
                            key={task.id}
                            type="button"
                            disabled={!task.exists}
                            onClick={() => {
                              if (!task.exists) return;
                              const checklistPath = buildCategoryPath(
                                task.checklistCategory || "Uncategorized",
                                task.checklistId,
                              );
                              router.push(`/checklist/${checklistPath}`);
                            }}
                            className={cn(
                              "flex w-full items-start justify-between gap-3 rounded-jotty border border-border bg-background px-3 py-2 text-left transition-colors",
                              task.exists && "hover:bg-accent",
                              !task.exists && "cursor-not-allowed opacity-70",
                            )}
                          >
                            <div className="min-w-0 space-y-1">
                              <p className="truncate text-md lg:text-sm font-medium">
                                {task.title}
                              </p>
                              <p className="text-sm lg:text-xs text-muted-foreground">
                                {task.checklistTitle || task.checklistId}
                                {task.targetDate
                                  ? ` · Due ${formatWorkflowDateTime(task.targetDate)}`
                                  : ""}
                              </p>
                              {(task.priority || task.assignee) && (
                                <p className="text-sm lg:text-xs text-muted-foreground">
                                  {task.priority ? `Priority: ${task.priority}` : ""}
                                  {task.priority && task.assignee ? " · " : ""}
                                  {task.assignee ? `Assigned to ${task.assignee}` : ""}
                                </p>
                              )}
                            </div>
                            <span
                              className={cn(
                                "shrink-0 rounded-full px-2 py-0.5 text-xs font-medium",
                                statusClassName,
                              )}
                            >
                              {statusLabel}
                            </span>
                          </button>
                        );
                      })
                    ) : (
                      <p className="text-md lg:text-sm text-muted-foreground">
                        No linked tasks yet.
                      </p>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
      {showShareModal && (
        <ShareModal
          isOpen={showShareModal}
          onClose={() => {
            setShowShareModal(false);
            router.refresh();
          }}
        />
      )}

      <SharedWithModal
        usernames={itemDetails.sharedWith}
        isOpen={showSharedWithModal}
        onClose={() => setShowSharedWithModal(false)}
      />

      {(() => {
        const currentMethod = detectEncryptionMethod(note?.content || "");
        const preferredMethod = user?.encryptionSettings?.method || "xchacha";
        const methodToUse =
          encryptionModalMode === "encrypt" ? preferredMethod : currentMethod;

        return methodToUse === "pgp" ? (
          <PGPEncryptionModal
            isOpen={showEncryptionModal}
            onClose={() => setShowEncryptionModal(false)}
            mode={encryptionModalMode}
            noteContent={
              encryptionModalMode === "view" ||
                encryptionModalMode === "edit" ||
                encryptionModalMode === "save"
                ? note.content
                : viewModel.editorContent
            }
            onSuccess={
              encryptionModalMode === "view"
                ? handleViewDecryption
                : encryptionModalMode === "edit"
                  ? handleEditEncrypted
                  : encryptionModalMode === "save"
                    ? handleSaveEncrypted
                    : encryptionModalMode === "decrypt"
                      ? handlePermanentDecryption
                      : handleEncryptionSuccess
            }
          />
        ) : (
          <XChaChaEncryptionModal
            isOpen={showEncryptionModal}
            onClose={() => setShowEncryptionModal(false)}
            mode={encryptionModalMode}
            noteContent={
              encryptionModalMode === "view" ||
                encryptionModalMode === "edit" ||
                encryptionModalMode === "save"
                ? note.content
                : viewModel.editorContent
            }
            onSuccess={
              encryptionModalMode === "view"
                ? handleViewDecryption
                : encryptionModalMode === "edit"
                  ? handleEditEncrypted
                  : encryptionModalMode === "save"
                    ? handleSaveEncrypted
                    : encryptionModalMode === "decrypt"
                      ? handlePermanentDecryption
                      : handleEncryptionSuccess
            }
          />
        );
      })()}

      {showHistoryModal && (
        <NoteHistoryModal
          isOpen={showHistoryModal}
          onClose={() => setShowHistoryModal(false)}
          noteUuid={note.uuid || ""}
          noteId={note.id}
          noteCategory={note.category || "Uncategorized"}
          noteOwner={note.owner || ""}
          noteTitle={note.title}
          currentContent={note.content || ""}
          onRestore={() => router.refresh()}
        />
      )}
    </>
  );
};
