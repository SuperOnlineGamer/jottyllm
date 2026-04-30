"use server";

import fs from "fs/promises";
import path from "path";
import { revalidatePath, revalidateTag } from "next/cache";
import { USERS_FILE } from "@/app/_consts/files";
import { NOTE_TEMPLATES } from "@/app/_consts/notes";
import { readJsonFile, writeJsonFile } from "@/app/_server/actions/file";
import { getSettings } from "@/app/_server/actions/config/settings";
import { getCurrentUser } from "@/app/_server/actions/users";
import { getUserIndex } from "@/app/_server/actions/users/helpers";
import { logAudit } from "@/app/_server/actions/log";
import type { AppSettings, NoteTemplate, Result, User } from "@/app/_types";
import {
  getAvailableNoteTemplates,
  normalizeNoteTemplate,
  normalizeNoteTemplates,
} from "@/app/_utils/note-template-utils";

const DATA_SETTINGS_PATH = path.join(process.cwd(), "data", "settings.json");

/**
 * @todo fccview is telling you to review this AI generated code
 * and make sure it's up to standards, reusable, modular and consistent with
 * the rest of the codebase.
 */
const parseTemplateTags = (value: FormDataEntryValue | null): string[] => {
  if (typeof value !== "string") return [];
  return value
    .split(",")
    .map((tag) => tag.trim())
    .filter(Boolean);
};

/**
 * @todo fccview is telling you to review this AI generated code
 * and make sure it's up to standards, reusable, modular and consistent with
 * the rest of the codebase.
 */
const templateFromFormData = (
  formData: FormData,
  scope: "admin" | "user",
  owner?: string,
): NoteTemplate | null => {
  return normalizeNoteTemplate(
    {
      id: (formData.get("id") as string) || undefined,
      name: (formData.get("name") as string) || "",
      description: (formData.get("description") as string) || "",
      titleTemplate: (formData.get("titleTemplate") as string) || undefined,
      content: (formData.get("content") as string) || "",
      tags: parseTemplateTags(formData.get("tags")),
      required: formData.get("required") === "true",
      createdAt: (formData.get("createdAt") as string) || undefined,
    },
    scope,
    owner,
  );
};

/**
 * @todo fccview is telling you to review this AI generated code
 * and make sure it's up to standards, reusable, modular and consistent with
 * the rest of the codebase.
 */
const writeAppTemplateSettings = async (settings: AppSettings) => {
  await fs.mkdir(path.dirname(DATA_SETTINGS_PATH), { recursive: true });
  await fs.writeFile(DATA_SETTINGS_PATH, JSON.stringify(settings, null, 2));
  revalidatePath("/");
  revalidatePath("/settings/admin/editor");
  revalidateTag("layout-notes", { expire: 0 });
};

/**
 * @todo fccview is telling you to review this AI generated code
 * and make sure it's up to standards, reusable, modular and consistent with
 * the rest of the codebase.
 */
const updateCurrentUserTemplates = async (
  updater: (user: User) => User,
): Promise<Result<{ user: User }>> => {
  const currentUser = await getCurrentUser();
  if (!currentUser) return { success: false, error: "Not authenticated" };

  const users = await readJsonFile(USERS_FILE);
  const userIndex = await getUserIndex(currentUser.username);
  const updatedUser = updater(users[userIndex]);
  users[userIndex] = updatedUser;
  await writeJsonFile(users, USERS_FILE);

  revalidatePath("/");
  revalidatePath("/settings/user-preferences");
  revalidateTag("layout-notes", { expire: 0 });

  return { success: true, data: { user: updatedUser } };
};

/**
 * @todo fccview is telling you to review this AI generated code
 * and make sure it's up to standards, reusable, modular and consistent with
 * the rest of the codebase.
 */
export const saveUserNoteTemplate = async (
  formData: FormData,
): Promise<Result<{ template: NoteTemplate; user: User }>> => {
  try {
    const currentUser = await getCurrentUser();
    if (!currentUser) return { success: false, error: "Not authenticated" };

    const template = templateFromFormData(formData, "user", currentUser.username);
    if (!template) return { success: false, error: "Template name is required" };

    const result = await updateCurrentUserTemplates((user) => {
      const templates = normalizeNoteTemplates(
        user.noteTemplates,
        "user",
        user.username,
      );
      const existingIndex = templates.findIndex((item) => item.id === template.id);
      const nextTemplates =
        existingIndex >= 0
          ? templates.map((item, index) => (index === existingIndex ? template : item))
          : [...templates, template];

      return { ...user, noteTemplates: nextTemplates };
    });

    if (!result.success || !result.data) return result as Result<any>;

    await logAudit({
      level: "INFO",
      action: "user_settings_updated",
      category: "settings",
      success: true,
      metadata: { scope: "user", templateId: template.id },
    });

    return { success: true, data: { template, user: result.data.user } };
  } catch (error) {
    console.error("Error saving user note template:", error);
    return { success: false, error: "Failed to save template" };
  }
};

/**
 * @todo fccview is telling you to review this AI generated code
 * and make sure it's up to standards, reusable, modular and consistent with
 * the rest of the codebase.
 */
export const deleteUserNoteTemplate = async (
  templateId: string,
): Promise<Result<{ user: User }>> => {
  try {
    return await updateCurrentUserTemplates((user) => ({
      ...user,
      noteTemplates: normalizeNoteTemplates(
        user.noteTemplates,
        "user",
        user.username,
      ).filter((template) => template.id !== templateId),
      hiddenNoteTemplateIds: (user.hiddenNoteTemplateIds || []).filter(
        (id) => id !== templateId,
      ),
      quickCreateNotesTemplate:
        user.quickCreateNotesTemplate === templateId
          ? undefined
          : user.quickCreateNotesTemplate,
    }));
  } catch (error) {
    console.error("Error deleting user note template:", error);
    return { success: false, error: "Failed to delete template" };
  }
};

/**
 * @todo fccview is telling you to review this AI generated code
 * and make sure it's up to standards, reusable, modular and consistent with
 * the rest of the codebase.
 */
export const setUserNoteTemplateHidden = async (
  templateId: string,
  hidden: boolean,
): Promise<Result<{ user: User }>> => {
  try {
    const settings = await getSettings();
    const template = getAvailableNoteTemplates({
      adminTemplates: settings.noteTemplates,
      userTemplates: [],
      includeHidden: true,
      includeUser: false,
    }).find((item) => item.id === templateId);

    if (template?.required || NOTE_TEMPLATES.some((item) => item.id === templateId && item.required)) {
      return { success: false, error: "This template is required" };
    }

    return await updateCurrentUserTemplates((user) => {
      const hiddenIds = new Set(user.hiddenNoteTemplateIds || []);
      if (hidden) {
        hiddenIds.add(templateId);
      } else {
        hiddenIds.delete(templateId);
      }

      return { ...user, hiddenNoteTemplateIds: Array.from(hiddenIds) };
    });
  } catch (error) {
    console.error("Error updating hidden note template:", error);
    return { success: false, error: "Failed to update template visibility" };
  }
};

/**
 * @todo fccview is telling you to review this AI generated code
 * and make sure it's up to standards, reusable, modular and consistent with
 * the rest of the codebase.
 */
export const saveAdminNoteTemplate = async (
  formData: FormData,
): Promise<Result<{ template: NoteTemplate }>> => {
  try {
    const currentUser = await getCurrentUser();
    if (!currentUser?.isAdmin) {
      return { success: false, error: "Unauthorized: Admin access required" };
    }

    const template = templateFromFormData(formData, "admin");
    if (!template) return { success: false, error: "Template name is required" };

    const settings = await getSettings();
    const templates = normalizeNoteTemplates(settings.noteTemplates, "admin");
    const existingIndex = templates.findIndex((item) => item.id === template.id);
    settings.noteTemplates =
      existingIndex >= 0
        ? templates.map((item, index) => (index === existingIndex ? template : item))
        : [...templates, template];

    await writeAppTemplateSettings(settings);
    await logAudit({
      level: "INFO",
      action: "app_settings_updated",
      category: "settings",
      success: true,
      metadata: { templateId: template.id, required: template.required },
    });

    return { success: true, data: { template } };
  } catch (error) {
    console.error("Error saving admin note template:", error);
    return { success: false, error: "Failed to save admin template" };
  }
};

/**
 * @todo fccview is telling you to review this AI generated code
 * and make sure it's up to standards, reusable, modular and consistent with
 * the rest of the codebase.
 */
export const deleteAdminNoteTemplate = async (
  templateId: string,
): Promise<Result<null>> => {
  try {
    const currentUser = await getCurrentUser();
    if (!currentUser?.isAdmin) {
      return { success: false, error: "Unauthorized: Admin access required" };
    }

    const settings = await getSettings();
    settings.noteTemplates = normalizeNoteTemplates(
      settings.noteTemplates,
      "admin",
    ).filter((template) => template.id !== templateId);
    if (settings.defaultNoteTemplateId === templateId) {
      settings.defaultNoteTemplateId = "blank";
    }

    await writeAppTemplateSettings(settings);
    return { success: true, data: null };
  } catch (error) {
    console.error("Error deleting admin note template:", error);
    return { success: false, error: "Failed to delete admin template" };
  }
};

/**
 * @todo fccview is telling you to review this AI generated code
 * and make sure it's up to standards, reusable, modular and consistent with
 * the rest of the codebase.
 */
export const setDefaultNoteTemplate = async (
  templateId: string,
): Promise<Result<null>> => {
  try {
    const currentUser = await getCurrentUser();
    if (!currentUser?.isAdmin) {
      return { success: false, error: "Unauthorized: Admin access required" };
    }

    const settings = await getSettings();
    const availableTemplates = getAvailableNoteTemplates({
      adminTemplates: settings.noteTemplates,
      includeUser: false,
      includeHidden: true,
    });
    const nextTemplateId = availableTemplates.some((template) => template.id === templateId)
      ? templateId
      : "blank";

    settings.defaultNoteTemplateId = nextTemplateId;
    await writeAppTemplateSettings(settings);
    return { success: true, data: null };
  } catch (error) {
    console.error("Error setting default note template:", error);
    return { success: false, error: "Failed to set default template" };
  }
};