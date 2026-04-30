"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Delete03Icon,
  Edit02Icon,
  Copy01Icon,
  ViewIcon,
  ViewOffSlashIcon,
} from "hugeicons-react";
import { useTranslations } from "next-intl";
import { Button } from "@/app/_components/GlobalComponents/Buttons/Button";
import { Dropdown } from "@/app/_components/GlobalComponents/Dropdowns/Dropdown";
import { Input } from "@/app/_components/GlobalComponents/FormElements/Input";
import { Label } from "@/app/_components/GlobalComponents/FormElements/label";
import { Textarea } from "@/app/_components/GlobalComponents/FormElements/Textarea";
import { Toggle } from "@/app/_components/GlobalComponents/FormElements/Toggle";
import { useToast } from "@/app/_providers/ToastProvider";
import { useAppMode } from "@/app/_providers/AppModeProvider";
import type { NoteTemplate, SanitisedUser } from "@/app/_types";
import {
  deleteAdminNoteTemplate,
  deleteUserNoteTemplate,
  saveAdminNoteTemplate,
  saveUserNoteTemplate,
  setDefaultNoteTemplate,
  setUserNoteTemplateHidden,
} from "@/app/_server/actions/templates";
import {
  getAvailableNoteTemplates,
  normalizeNoteTemplates,
} from "@/app/_utils/note-template-utils";
import { cn } from "@/app/_utils/global-utils";

type TemplateManagerScope = "admin" | "user";

interface TemplateDraft {
  id: string;
  name: string;
  description: string;
  titleTemplate: string;
  content: string;
  tags: string;
  required: boolean;
  createdAt?: string;
}

interface NoteTemplateManagerProps {
  scope: TemplateManagerScope;
  adminTemplates?: NoteTemplate[];
  userTemplates?: NoteTemplate[];
  hiddenTemplateIds?: string[];
  defaultTemplateId?: string;
}

const emptyDraft: TemplateDraft = {
  id: "",
  name: "",
  description: "",
  titleTemplate: "",
  content: "",
  tags: "",
  required: false,
};

/**
 * @todo fccview is telling you to review this AI generated code
 * and make sure it's up to standards, reusable, modular and consistent with
 * the rest of the codebase.
 */
const getTemplateLabel = (
  template: NoteTemplate,
  translate: ReturnType<typeof useTranslations>,
): string => {
  if (template.name) return template.name;
  if (template.nameKey) return translate(template.nameKey);
  return template.id;
};

/**
 * @todo fccview is telling you to review this AI generated code
 * and make sure it's up to standards, reusable, modular and consistent with
 * the rest of the codebase.
 */
const getTemplateDescription = (
  template: NoteTemplate,
  translate: ReturnType<typeof useTranslations>,
): string => {
  if (template.description) return template.description;
  if (template.descriptionKey) return translate(template.descriptionKey);
  return "";
};

/**
 * @todo fccview is telling you to review this AI generated code
 * and make sure it's up to standards, reusable, modular and consistent with
 * the rest of the codebase.
 */
const templateToDraft = (
  template: NoteTemplate,
  translate: ReturnType<typeof useTranslations>,
): TemplateDraft => ({
  id: template.id,
  name: getTemplateLabel(template, translate),
  description: getTemplateDescription(template, translate),
  titleTemplate: template.titleTemplate || "",
  content: template.content || "",
  tags: (template.tags || []).join(", "),
  required: Boolean(template.required),
  createdAt: template.createdAt,
});

/**
 * @todo fccview is telling you to review this AI generated code
 * and make sure it's up to standards, reusable, modular and consistent with
 * the rest of the codebase.
 */
export const NoteTemplateManager = ({
  scope,
  adminTemplates = [],
  userTemplates = [],
  hiddenTemplateIds = [],
  defaultTemplateId = "blank",
}: NoteTemplateManagerProps) => {
  const t = useTranslations();
  const router = useRouter();
  const { showToast } = useToast();
  const { setUser } = useAppMode();
  const [localAdminTemplates, setLocalAdminTemplates] = useState(
    normalizeNoteTemplates(adminTemplates, "admin"),
  );
  const [localUserTemplates, setLocalUserTemplates] = useState(
    normalizeNoteTemplates(userTemplates, "user"),
  );
  const [localHiddenTemplateIds, setLocalHiddenTemplateIds] = useState(
    hiddenTemplateIds,
  );
  const [localDefaultTemplateId, setLocalDefaultTemplateId] = useState(
    defaultTemplateId || "blank",
  );
  const [draft, setDraft] = useState<TemplateDraft>(emptyDraft);
  const [isSaving, setIsSaving] = useState(false);
  const [busyTemplateId, setBusyTemplateId] = useState<string | null>(null);

  const visibleTemplates = useMemo(
    () =>
      getAvailableNoteTemplates({
        adminTemplates: localAdminTemplates,
        userTemplates: scope === "user" ? localUserTemplates : [],
        hiddenTemplateIds: localHiddenTemplateIds,
        includeHidden: true,
        includeUser: scope === "user",
      }),
    [localAdminTemplates, localHiddenTemplateIds, localUserTemplates, scope],
  );

  const editableTemplates = scope === "admin" ? localAdminTemplates : localUserTemplates;
  const defaultOptions = getAvailableNoteTemplates({
    adminTemplates: localAdminTemplates,
    includeUser: false,
    includeHidden: true,
  }).map((template) => ({ id: template.id, name: getTemplateLabel(template, t) }));

  const resetDraft = () => setDraft(emptyDraft);

  const buildFormData = () => {
    const formData = new FormData();
    if (draft.id) formData.append("id", draft.id);
    if (draft.createdAt) formData.append("createdAt", draft.createdAt);
    formData.append("name", draft.name.trim());
    formData.append("description", draft.description.trim());
    formData.append("titleTemplate", draft.titleTemplate.trim());
    formData.append("content", draft.content);
    formData.append("tags", draft.tags);
    formData.append("required", String(draft.required));
    return formData;
  };

  const handleSaveTemplate = async () => {
    if (!draft.name.trim()) {
      showToast({
        type: "error",
        title: t("common.error"),
        message: "Template name is required.",
      });
      return;
    }

    setIsSaving(true);
    try {
      const result = scope === "admin"
        ? await saveAdminNoteTemplate(buildFormData())
        : await saveUserNoteTemplate(buildFormData());

      if (!result.success || !result.data) {
        throw new Error(result.error || "Failed to save template");
      }

      if (scope === "admin") {
        const template = result.data.template;
        setLocalAdminTemplates((current) => {
          const exists = current.some((item) => item.id === template.id);
          return exists
            ? current.map((item) => (item.id === template.id ? template : item))
            : [...current, template];
        });
      } else {
        const userResult = result.data as { template: NoteTemplate; user: SanitisedUser };
        setLocalUserTemplates(userResult.user.noteTemplates || []);
        setUser(userResult.user);
      }

      resetDraft();
      router.refresh();
      showToast({
        type: "success",
        title: t("common.success"),
        message: "Template saved.",
      });
    } catch (error) {
      showToast({
        type: "error",
        title: t("common.error"),
        message: error instanceof Error ? error.message : "Failed to save template.",
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteTemplate = async (templateId: string) => {
    setBusyTemplateId(templateId);
    try {
      const result = scope === "admin"
        ? await deleteAdminNoteTemplate(templateId)
        : await deleteUserNoteTemplate(templateId);

      if (!result.success) throw new Error(result.error || "Failed to delete template");

      if (scope === "admin") {
        setLocalAdminTemplates((current) => current.filter((item) => item.id !== templateId));
        if (localDefaultTemplateId === templateId) setLocalDefaultTemplateId("blank");
      } else if (result.data?.user) {
        setLocalUserTemplates(result.data.user.noteTemplates || []);
        setLocalHiddenTemplateIds(result.data.user.hiddenNoteTemplateIds || []);
        setUser(result.data.user);
      }

      if (draft.id === templateId) resetDraft();
      router.refresh();
    } catch (error) {
      showToast({
        type: "error",
        title: t("common.error"),
        message: error instanceof Error ? error.message : "Failed to delete template.",
      });
    } finally {
      setBusyTemplateId(null);
    }
  };

  const handleToggleHidden = async (templateId: string, hidden: boolean) => {
    setBusyTemplateId(templateId);
    try {
      const result = await setUserNoteTemplateHidden(templateId, hidden);
      if (!result.success || !result.data) {
        throw new Error(result.error || "Failed to update template visibility");
      }
      setLocalHiddenTemplateIds(result.data.user.hiddenNoteTemplateIds || []);
      setUser(result.data.user);
      router.refresh();
    } catch (error) {
      showToast({
        type: "error",
        title: t("common.error"),
        message: error instanceof Error ? error.message : "Failed to update template visibility.",
      });
    } finally {
      setBusyTemplateId(null);
    }
  };

  const handleDefaultChange = async (templateId: string) => {
    setLocalDefaultTemplateId(templateId);
    const result = await setDefaultNoteTemplate(templateId);
    if (!result.success) {
      showToast({
        type: "error",
        title: t("common.error"),
        message: result.error || "Failed to update default template.",
      });
      return;
    }
    router.refresh();
  };

  return (
    <div className="space-y-6">
      {scope === "admin" && (
        <div className="space-y-2">
          <Label htmlFor="default-note-template">Instance default template</Label>
          <Dropdown
            value={localDefaultTemplateId || "blank"}
            onChange={handleDefaultChange}
            options={defaultOptions}
            className="w-full"
          />
          <p className="text-md lg:text-sm text-muted-foreground">
            New note dialogs use this template unless a user chooses another one.
          </p>
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(300px,420px)]">
        <div className="space-y-3">
          {visibleTemplates.map((template) => {
            const isHidden = localHiddenTemplateIds.includes(template.id);
            const canEdit = template.scope === scope;
            const canHide = scope === "user" && template.scope !== "user" && !template.required;

            return (
              <div
                key={template.id}
                className={cn(
                  "rounded-jotty border border-border bg-background p-4",
                  isHidden && "opacity-60",
                )}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h4 className="font-medium text-foreground">
                        {getTemplateLabel(template, t)}
                      </h4>
                      <span className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
                        {template.scope === "admin"
                          ? "Admin"
                          : template.scope === "user"
                            ? "Mine"
                            : "System"}
                      </span>
                      {template.required && (
                        <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs text-primary">
                          Required
                        </span>
                      )}
                      {isHidden && (
                        <span className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
                          Hidden
                        </span>
                      )}
                    </div>
                    {getTemplateDescription(template, t) && (
                      <p className="text-md lg:text-sm text-muted-foreground">
                        {getTemplateDescription(template, t)}
                      </p>
                    )}
                    {(template.titleTemplate || template.tags?.length) && (
                      <p className="text-sm lg:text-xs text-muted-foreground">
                        {template.titleTemplate || "Untitled"}
                        {template.tags?.length ? ` · ${template.tags.join(", ")}` : ""}
                      </p>
                    )}
                  </div>
                  <div className="flex shrink-0 items-center gap-1">
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      title="Duplicate"
                      onClick={() =>
                        setDraft({
                          ...templateToDraft(template, t),
                          id: "",
                          name: `${getTemplateLabel(template, t)} Copy`,
                          required: false,
                        })
                      }
                    >
                      <Copy01Icon className="h-4 w-4" />
                    </Button>
                    {canEdit && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        title={t("common.edit")}
                        onClick={() => setDraft(templateToDraft(template, t))}
                      >
                        <Edit02Icon className="h-4 w-4" />
                      </Button>
                    )}
                    {canEdit && (
                      <Button
                        type="button"
                        variant="destructive"
                        size="icon"
                        title={t("common.delete")}
                        disabled={busyTemplateId === template.id}
                        onClick={() => handleDeleteTemplate(template.id)}
                      >
                        <Delete03Icon className="h-4 w-4" />
                      </Button>
                    )}
                    {canHide && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        title={isHidden ? "Show" : "Hide"}
                        disabled={busyTemplateId === template.id}
                        onClick={() => handleToggleHidden(template.id, !isHidden)}
                      >
                        {isHidden ? (
                          <ViewIcon className="h-4 w-4" />
                        ) : (
                          <ViewOffSlashIcon className="h-4 w-4" />
                        )}
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}

          {editableTemplates.length === 0 && (
            <div className="rounded-jotty border border-dashed border-border bg-background p-6 text-center text-md lg:text-sm text-muted-foreground">
              {scope === "admin"
                ? "No admin templates yet."
                : "No personal templates yet."}
            </div>
          )}
        </div>

        <div className="rounded-jotty border border-border bg-background p-4">
          <div className="space-y-4">
            <div>
              <h4 className="font-medium text-foreground">
                {draft.id ? "Edit template" : "New template"}
              </h4>
              <p className="text-md lg:text-sm text-muted-foreground">
                Variables: {"{{title}}"}, {"{{date}}"}, {"{{time}}"}, {"{{category}}"}, {"{{username}}"}.
              </p>
            </div>

            <Input
              id={`${scope}-template-name`}
              type="text"
              label="Name"
              value={draft.name}
              onChange={(event) => setDraft((current) => ({ ...current, name: event.target.value }))}
            />
            <Input
              id={`${scope}-template-description`}
              type="text"
              label="Description"
              value={draft.description}
              onChange={(event) => setDraft((current) => ({ ...current, description: event.target.value }))}
            />
            <Input
              id={`${scope}-template-title`}
              type="text"
              label="Title template"
              placeholder="Meeting - {{date}}"
              value={draft.titleTemplate}
              onChange={(event) => setDraft((current) => ({ ...current, titleTemplate: event.target.value }))}
            />
            <Textarea
              id={`${scope}-template-content`}
              label="Content"
              value={draft.content}
              onChange={(event) => setDraft((current) => ({ ...current, content: event.target.value }))}
              rows={10}
              minHeight="220px"
            />
            <Input
              id={`${scope}-template-tags`}
              type="text"
              label="Tags"
              placeholder="meeting, work"
              value={draft.tags}
              onChange={(event) => setDraft((current) => ({ ...current, tags: event.target.value }))}
              description="Comma-separated tags are added when notes are created from this template."
            />
            {scope === "admin" && (
              <div className="flex items-center justify-between gap-3">
                <Label htmlFor="template-required" className="cursor-pointer">
                  Always visible to users
                </Label>
                <Toggle
                  id="template-required"
                  checked={draft.required}
                  onCheckedChange={(required) =>
                    setDraft((current) => ({ ...current, required }))
                  }
                />
              </div>
            )}

            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={resetDraft}>
                {t("common.reset")}
              </Button>
              <Button type="button" onClick={handleSaveTemplate} disabled={isSaving}>
                {isSaving ? t("common.saving") : t("common.save")}
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};