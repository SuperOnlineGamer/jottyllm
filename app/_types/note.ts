import { ItemTypes } from "./enums";
import { EncryptionMethod } from "./encryption";

export interface NoteReminder {
  id: string;
  dueAt: string;
  title?: string;
  status: "pending" | "done" | "dismissed";
  notify?: boolean;
  repeatRule?: string;
  createdAt: string;
  createdBy?: string;
  completedAt?: string;
}

export interface NoteLinkedTask {
  id: string;
  checklistId: string;
  checklistUuid?: string;
  checklistCategory?: string;
  itemId: string;
  title: string;
  sourceText?: string;
  createdAt: string;
  createdBy?: string;
}

export interface NoteComment {
  id: string;
  body: string;
  author: string;
  createdAt: string;
  updatedAt?: string;
  resolvedAt?: string;
  resolvedBy?: string;
}

export interface Note {
  id: string;
  uuid?: string;
  title: string;
  content: string;
  itemType?: ItemTypes;
  category?: string;
  createdAt: string;
  updatedAt: string;
  owner?: string;
  isShared?: boolean;
  rawContent?: string;
  encrypted?: boolean;
  encryptedContent?: string;
  encryptionMethod?: EncryptionMethod;
  tags?: string[];
  reminders?: NoteReminder[];
  linkedTasks?: NoteLinkedTask[];
  comments?: NoteComment[];
}

export interface NoteSaveOptions {
  exitEditMode?: boolean;
}

export type NoteSaveState = "idle" | "saving" | "auto-saving" | "saved" | "error";

export type NoteTemplateScope = "system" | "admin" | "user";

export interface NoteTemplate {
  id: string;
  nameKey?: string;
  descriptionKey?: string;
  name?: string;
  description?: string;
  titleTemplate?: string;
  content: string;
  tags?: string[];
  scope?: NoteTemplateScope;
  owner?: string;
  required?: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export interface NoteEditorViewModel {
  title: string;
  setTitle: (title: string) => void;
  category: string;
  setCategory: (category: string) => void;
  tags: string[];
  setTags: (tags: string[]) => void;
  handleAddTag: (tag: string) => void;
  handleRemoveTag: (tag: string) => void;
  editorContent: string;
  isEditing: boolean;
  setIsEditing: (isEditing: boolean) => void;
  status: {
    isSaving: boolean;
    isAutoSaving: boolean;
    saveState: NoteSaveState;
    lastSavedAt: number | null;
    error: string | null;
    hasQueuedSave: boolean;
  };
  hasUnsavedChanges: boolean;
  handleEdit: () => void;
  handleCancel: () => void;
  handleSave: (
    autosaveNotes?: boolean,
    passphrase?: string,
    options?: NoteSaveOptions,
  ) => Promise<boolean>;
  handleDelete: () => void;
  handleEditorContentChange: (
    content: string,
    isMarkdown: boolean,
    isDirty: boolean
  ) => void;
  showUnsavedChangesModal: boolean;
  setShowUnsavedChangesModal: (show: boolean) => void;
  handleUnsavedChangesSave: () => void;
  handleUnsavedChangesDiscard: () => void;
  derivedMarkdownContent: string;
  handlePrint: () => void;
  isPrinting: boolean;
  setIsPrinting: (isPrinting: boolean) => void;
  isEditingEncrypted: boolean;
  handleEditEncrypted: (
    passphrase: string,
    method: string,
    decryptedContent: string
  ) => void;
  cachePassphrase: (passphrase: string, method: string) => void;
  clearPassphraseCache: () => void;
  getCachedPassphrase: () => string | null;
  getCachedMethod: () => string | null;
}
