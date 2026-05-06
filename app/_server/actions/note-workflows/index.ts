"use server";

import path from "path";
import { revalidatePath, revalidateTag } from "next/cache";
import { NOTES_DIR } from "@/app/_consts/files";
import { ensureDir, serverWriteFile } from "@/app/_server/actions/file";
import { getListById } from "@/app/_server/actions/checklist";
import { createItem } from "@/app/_server/actions/checklist-item";
import { getNoteById, getUserNotes } from "@/app/_server/actions/note";
import { noteToMarkdown } from "@/app/_server/actions/note/parsers";
import { getCurrentUser } from "@/app/_server/actions/users";
import { checkUserPermission } from "@/app/_server/actions/sharing";
import { broadcast } from "@/app/_server/ws/broadcast";
import { generateNoteRemindersICS } from "@/app/_utils/kanban/calendar-utils";
import type {
  Note,
  NoteComment,
  NoteLinkedTask,
  NoteLinkedTaskPreview,
  NoteReminder,
  Result,
} from "@/app/_types";
import { ItemTypes, PermissionTypes } from "@/app/_types/enums";
import { findItem } from "@/app/_utils/item-tree-utils";

/**
 * @todo fccview is telling you to review this AI generated code
 * and make sure it's up to standards, reusable, modular and consistent with
 * the rest of the codebase.
 */
const createWorkflowId = (prefix: string): string => {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
};

/**
 * @todo fccview is telling you to review this AI generated code
 * and make sure it's up to standards, reusable, modular and consistent with
 * the rest of the codebase.
 */
const parseReminderDueAt = (
  dueAt: string,
  timezoneOffsetMinutes?: string,
): Date | null => {
  const trimmedDueAt = dueAt.trim();
  if (!trimmedDueAt) return null;

  const hasExplicitTimezone = /(?:z|[+-]\d{2}:?\d{2})$/i.test(trimmedDueAt);
  if (hasExplicitTimezone) {
    const date = new Date(trimmedDueAt);
    return Number.isNaN(date.getTime()) ? null : date;
  }

  const offset = Number(timezoneOffsetMinutes);
  const localMatch = trimmedDueAt.match(
    /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?$/,
  );

  if (localMatch && Number.isFinite(offset)) {
    const [, year, month, day, hour, minute, second = "0"] = localMatch;
    // fccview is onto you!
    const timestamp = Date.UTC(
      Number(year),
      Number(month) - 1,
      Number(day),
      Number(hour),
      Number(minute),
      Number(second),
    ) + offset * 60 * 1000;
    const date = new Date(timestamp);
    return Number.isNaN(date.getTime()) ? null : date;
  }

  const date = new Date(trimmedDueAt);
  return Number.isNaN(date.getTime()) ? null : date;
};

/**
 * @todo fccview is telling you to review this AI generated code
 * and make sure it's up to standards, reusable, modular and consistent with
 * the rest of the codebase.
 */
const getEditableNoteFromForm = async (
  formData: FormData,
): Promise<Result<{ note: Note; username: string }>> => {
  return getNoteFromFormWithPermission(formData, PermissionTypes.EDIT);
};

const getNoteFromFormWithPermission = async (
  formData: FormData,
  permission: PermissionTypes,
): Promise<Result<{ note: Note; username: string }>> => {
  const currentUser = await getCurrentUser();
  if (!currentUser?.username) {
    return { success: false, error: "Not authenticated" };
  }

  const noteId = (formData.get("noteId") as string) || "";
  const noteCategory = (formData.get("noteCategory") as string) || "Uncategorized";
  const note = await getNoteById(noteId, noteCategory);

  if (!note) return { success: false, error: "Note not found" };

  const hasPermission = await checkUserPermission(
    note.uuid || note.id,
    note.category || "Uncategorized",
    ItemTypes.NOTE,
    currentUser.username,
    permission,
  );

  if (!hasPermission) return { success: false, error: "Permission denied" };

  return { success: true, data: { note, username: currentUser.username } };
};

const resolveLinkedTaskPreview = async (
  linkedTask: NoteLinkedTask,
  username: string,
): Promise<NoteLinkedTaskPreview> => {
  let checklist = linkedTask.checklistUuid
    ? await getListById(linkedTask.checklistUuid)
    : undefined;

  if (!checklist) {
    checklist = await getListById(
      linkedTask.checklistId,
      username,
      linkedTask.checklistCategory || "Uncategorized",
    );
  }

  if (!checklist) {
    return { ...linkedTask, exists: false };
  }

  const item = findItem(checklist.items, linkedTask.itemId);
  if (!item) {
    return {
      ...linkedTask,
      exists: false,
      checklistId: checklist.id,
      checklistUuid: checklist.uuid,
      checklistCategory: checklist.category,
      checklistTitle: checklist.title,
      checklistType: checklist.type,
    };
  }

  const statusLabel = item.status
    ? checklist.statuses?.find((status) => status.id === item.status)?.label || item.status
    : undefined;

  return {
    ...linkedTask,
    exists: true,
    checklistId: checklist.id,
    checklistUuid: checklist.uuid,
    checklistCategory: checklist.category,
    checklistTitle: checklist.title,
    checklistType: checklist.type,
    title: item.text || linkedTask.title,
    completed: item.completed,
    status: item.status,
    statusLabel,
    targetDate: item.targetDate,
    priority: item.priority,
    assignee: item.assignee,
    itemArchived: item.isArchived,
    itemDescription: item.description,
    updatedAt: item.lastModifiedAt || checklist.updatedAt,
  };
};

/**
 * @todo fccview is telling you to review this AI generated code
 * and make sure it's up to standards, reusable, modular and consistent with
 * the rest of the codebase.
 */
const saveNoteWorkflowMetadata = async (note: Note, username: string) => {
  const ownerDir = NOTES_DIR(note.owner || username);
  const categoryDir = path.join(ownerDir, note.category || "Uncategorized");
  await ensureDir(categoryDir);
  await serverWriteFile(
    path.join(categoryDir, `${note.id}.md`),
    noteToMarkdown({ ...note, updatedAt: new Date().toISOString() }),
  );
  revalidatePath("/");
  revalidatePath(`/note/${note.category || "Uncategorized"}/${note.id}`);
  revalidateTag("layout-notes", { expire: 0 });
  await broadcast({
    type: "note",
    action: "updated",
    entityId: note.uuid || note.id,
    username,
  });
};

/**
 * @todo fccview is telling you to review this AI generated code
 * and make sure it's up to standards, reusable, modular and consistent with
 * the rest of the codebase.
 */
export const upsertNoteReminder = async (
  formData: FormData,
): Promise<Result<{ reminder: NoteReminder; note: Note }>> => {
  try {
    const noteResult = await getEditableNoteFromForm(formData);
    if (!noteResult.success || !noteResult.data) return noteResult as Result<any>;

    const dueAt = (formData.get("dueAt") as string) || "";
    const parsedDueAt = parseReminderDueAt(
      dueAt,
      formData.get("timezoneOffsetMinutes") as string | undefined,
    );
    if (!parsedDueAt) {
      return { success: false, error: "A valid reminder date is required" };
    }

    const now = new Date().toISOString();
    const reminderId = (formData.get("reminderId") as string) || createWorkflowId("reminder");
    const existingReminders = noteResult.data.note.reminders || [];
    const existingReminder = existingReminders.find((item) => item.id === reminderId);
    const reminder: NoteReminder = {
      id: reminderId,
      dueAt: parsedDueAt.toISOString(),
      title: ((formData.get("title") as string) || "").trim() || undefined,
      status: ((formData.get("status") as NoteReminder["status"]) || existingReminder?.status || "pending"),
      notify: formData.get("notify") !== "false",
      repeatRule: ((formData.get("repeatRule") as string) || "").trim() || undefined,
      createdAt: existingReminder?.createdAt || now,
      createdBy: existingReminder?.createdBy || noteResult.data.username,
      completedAt: formData.get("status") === "done" ? now : existingReminder?.completedAt,
    };
    const nextNote = {
      ...noteResult.data.note,
      reminders: [
        ...existingReminders.filter((item) => item.id !== reminderId),
        reminder,
      ],
    };

    await saveNoteWorkflowMetadata(nextNote, noteResult.data.username);
    return { success: true, data: { reminder, note: nextNote } };
  } catch (error) {
    console.error("Error saving note reminder:", error);
    return { success: false, error: "Failed to save reminder" };
  }
};

/**
 * @todo fccview is telling you to review this AI generated code
 * and make sure it's up to standards, reusable, modular and consistent with
 * the rest of the codebase.
 */
export const deleteNoteReminder = async (
  formData: FormData,
): Promise<Result<{ note: Note }>> => {
  try {
    const noteResult = await getEditableNoteFromForm(formData);
    if (!noteResult.success || !noteResult.data) return noteResult as Result<any>;

    const reminderId = (formData.get("reminderId") as string) || "";
    const nextNote = {
      ...noteResult.data.note,
      reminders: (noteResult.data.note.reminders || []).filter(
        (reminder) => reminder.id !== reminderId,
      ),
    };

    await saveNoteWorkflowMetadata(nextNote, noteResult.data.username);
    return { success: true, data: { note: nextNote } };
  } catch (error) {
    console.error("Error deleting note reminder:", error);
    return { success: false, error: "Failed to delete reminder" };
  }
};

/**
 * @todo fccview is telling you to review this AI generated code
 * and make sure it's up to standards, reusable, modular and consistent with
 * the rest of the codebase.
 */
export const addNoteComment = async (
  formData: FormData,
): Promise<Result<{ comment: NoteComment; note: Note }>> => {
  try {
    const noteResult = await getEditableNoteFromForm(formData);
    if (!noteResult.success || !noteResult.data) return noteResult as Result<any>;

    const body = ((formData.get("body") as string) || "").trim();
    if (!body) return { success: false, error: "Comment text is required" };

    const comment: NoteComment = {
      id: createWorkflowId("comment"),
      body,
      author: noteResult.data.username,
      createdAt: new Date().toISOString(),
    };
    const nextNote = {
      ...noteResult.data.note,
      comments: [...(noteResult.data.note.comments || []), comment],
    };

    await saveNoteWorkflowMetadata(nextNote, noteResult.data.username);
    return { success: true, data: { comment, note: nextNote } };
  } catch (error) {
    console.error("Error adding note comment:", error);
    return { success: false, error: "Failed to add comment" };
  }
};

/**
 * @todo fccview is telling you to review this AI generated code
 * and make sure it's up to standards, reusable, modular and consistent with
 * the rest of the codebase.
 */
export const resolveNoteComment = async (
  formData: FormData,
): Promise<Result<{ note: Note }>> => {
  try {
    const noteResult = await getEditableNoteFromForm(formData);
    if (!noteResult.success || !noteResult.data) return noteResult as Result<any>;

    const commentId = (formData.get("commentId") as string) || "";
    const now = new Date().toISOString();
    const nextNote = {
      ...noteResult.data.note,
      comments: (noteResult.data.note.comments || []).map((comment) =>
        comment.id === commentId
          ? { ...comment, resolvedAt: now, resolvedBy: noteResult.data!.username }
          : comment,
      ),
    };

    await saveNoteWorkflowMetadata(nextNote, noteResult.data.username);
    return { success: true, data: { note: nextNote } };
  } catch (error) {
    console.error("Error resolving note comment:", error);
    return { success: false, error: "Failed to resolve comment" };
  }
};

/**
 * @todo fccview is telling you to review this AI generated code
 * and make sure it's up to standards, reusable, modular and consistent with
 * the rest of the codebase.
 */
export const convertNoteTextToChecklistItem = async (
  formData: FormData,
): Promise<Result<{ linkedTask: NoteLinkedTask; note: Note }>> => {
  try {
    const noteResult = await getEditableNoteFromForm(formData);
    if (!noteResult.success || !noteResult.data) return noteResult as Result<any>;

    const checklistId = (formData.get("checklistId") as string) || "";
    const checklistCategory = (formData.get("checklistCategory") as string) || "Uncategorized";
    const checklist = await getListById(checklistId, undefined, checklistCategory);
    const text = ((formData.get("text") as string) || "").trim();

    if (!checklist) return { success: false, error: "Checklist not found" };
    if (!text) return { success: false, error: "Task text is required" };

    const itemFormData = new FormData();
    itemFormData.append("listId", checklist.id);
    itemFormData.append("category", checklist.category || "Uncategorized");
    itemFormData.append("text", text);
    itemFormData.append("description", `Created from note: ${noteResult.data.note.title}`);

    const itemResult = await createItem(checklist, itemFormData, noteResult.data.username);
    if (!itemResult.success || !itemResult.data) {
      return { success: false, error: itemResult.error || "Failed to create task" };
    }

    const linkedTask: NoteLinkedTask = {
      id: createWorkflowId("linked-task"),
      checklistId: checklist.id,
      checklistUuid: checklist.uuid,
      checklistCategory: checklist.category,
      itemId: itemResult.data.id,
      title: text,
      sourceText: text,
      createdAt: new Date().toISOString(),
      createdBy: noteResult.data.username,
    };
    const nextNote = {
      ...noteResult.data.note,
      linkedTasks: [...(noteResult.data.note.linkedTasks || []), linkedTask],
    };

    await saveNoteWorkflowMetadata(nextNote, noteResult.data.username);
    return { success: true, data: { linkedTask, note: nextNote } };
  } catch (error) {
    console.error("Error converting note text to checklist item:", error);
    return { success: false, error: "Failed to convert note text" };
  }
};

export const getNoteLinkedTaskPreviews = async (
  formData: FormData,
): Promise<Result<NoteLinkedTaskPreview[]>> => {
  try {
    const noteResult = await getNoteFromFormWithPermission(
      formData,
      PermissionTypes.READ,
    );
    if (!noteResult.success || !noteResult.data) return noteResult as Result<any>;

    const linkedTasks = noteResult.data.note.linkedTasks || [];
    const previews = await Promise.all(
      linkedTasks.map((linkedTask) =>
        resolveLinkedTaskPreview(linkedTask, noteResult.data!.username),
      ),
    );

    return { success: true, data: previews };
  } catch (error) {
    console.error("Error loading linked task previews:", error);
    return { success: false, error: "Failed to load linked tasks" };
  }
};

export const exportNoteRemindersAsICS = async (): Promise<Result<string>> => {
  try {
    const currentUser = await getCurrentUser();
    if (!currentUser?.username) {
      return { success: false, error: "Not authenticated" };
    }

    const notesResult = await getUserNotes({ username: currentUser.username });
    if (!notesResult.success || !notesResult.data) {
      return {
        success: false,
        error: notesResult.error || "Failed to fetch notes",
      };
    }

    return {
      success: true,
      data: generateNoteRemindersICS(notesResult.data, "Jotty Note Reminders"),
    };
  } catch (error) {
    console.error("Error exporting note reminders calendar:", error);
    return { success: false, error: "Failed to export note reminders" };
  }
};
