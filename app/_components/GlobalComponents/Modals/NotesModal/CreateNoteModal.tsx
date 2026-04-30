"use client";

import { useState, useEffect, useMemo, useRef } from "react";
import { Button } from "@/app/_components/GlobalComponents/Buttons/Button";
import { createNote } from "@/app/_server/actions/note";
import { Category, Note } from "@/app/_types";
import { Modal } from "../Modal";
import { CategoryInput } from "@/app/_components/GlobalComponents/FormElements/CategoryInput";
import { Modes } from "@/app/_types/enums";
import { createCategory } from "@/app/_server/actions/category";
import { useAppMode } from "@/app/_providers/AppModeProvider";
import { Input } from "@/app/_components/GlobalComponents/FormElements/Input";
import { Dropdown } from "@/app/_components/GlobalComponents/Dropdowns/Dropdown";
import { Toggle } from "@/app/_components/GlobalComponents/FormElements/Toggle";
import { PGPEncryptionModal } from "@/app/_components/GlobalComponents/Modals/EncryptionModals/PGPEncryptionModal";
import { XChaChaEncryptionModal } from "@/app/_components/GlobalComponents/Modals/EncryptionModals/XChaChaEncryptionModal";
import { useTranslations } from "next-intl";
import {
  applyNoteTemplate,
  getAvailableNoteTemplates,
  getNoteTemplateById,
} from "@/app/_utils/note-template-utils";

const ENCRYPTION_PLACEHOLDER_CONTENT = "Note placeholder";

interface CreateNoteModalProps {
  onClose: () => void;
  onCreated: (doc?: Note) => void;
  categories: Category[];
  initialCategory?: string;
}

export const CreateNoteModal = ({
  onClose,
  onCreated,
  categories,
  initialCategory = "",
}: CreateNoteModalProps) => {
  const t = useTranslations();
  const { user, appSettings } = useAppMode();
  const availableNoteTemplates = useMemo(
    () =>
      getAvailableNoteTemplates({
        adminTemplates: appSettings?.noteTemplates,
        userTemplates: user?.noteTemplates,
        hiddenTemplateIds: user?.hiddenNoteTemplateIds,
      }),
    [appSettings?.noteTemplates, user?.hiddenNoteTemplateIds, user?.noteTemplates],
  );
  const defaultTemplateId = getNoteTemplateById(
    appSettings?.defaultNoteTemplateId || "blank",
    availableNoteTemplates,
  ).id;
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState(initialCategory);
  const [newCategory, setNewCategory] = useState("");
  const [isCreating, setIsCreating] = useState(false);
  const [showNewCategory, setShowNewCategory] = useState(false);
  const [encryptOnCreate, setEncryptOnCreate] = useState(false);
  const [selectedTemplateId, setSelectedTemplateId] = useState(defaultTemplateId);
  const [encryptionDraftContent, setEncryptionDraftContent] = useState(
    ENCRYPTION_PLACEHOLDER_CONTENT,
  );
  const [showEncryptionModal, setShowEncryptionModal] = useState(false);
  const titleInputRef = useRef<HTMLInputElement>(null);
  const selectedTemplate = availableNoteTemplates.find(
    (template) => template.id === selectedTemplateId,
  );

  const encryptionMethod = user?.encryptionSettings?.method || "xchacha";

  const _previewCategoryPath = () => {
    if (showNewCategory && newCategory.trim()) {
      const newCatTrimmed = newCategory.trim();
      return category ? `${category}/${newCatTrimmed}` : newCatTrimmed;
    }
    return category || "Uncategorized";
  };

  useEffect(() => {
    titleInputRef.current?.focus();
  }, []);

  useEffect(() => {
    if (!availableNoteTemplates.some((template) => template.id === selectedTemplateId)) {
      setSelectedTemplateId(defaultTemplateId);
    }
  }, [availableNoteTemplates, defaultTemplateId, selectedTemplateId]);

  useEffect(() => {
    if (title.trim() || defaultTemplateId === "blank") return;
    const templatePayload = applyNoteTemplate(
      defaultTemplateId,
      {
        title: "",
        category: _previewCategoryPath(),
        username: user?.username || "",
      },
      availableNoteTemplates,
    );
    if (templatePayload.title) setTitle(templatePayload.title);
  }, [defaultTemplateId]);

  const _resolveCategoryPath = async (): Promise<string> => {
    if (showNewCategory && newCategory.trim()) {
      const newCatTrimmed = newCategory.trim();
      const categoryFormData = new FormData();
      categoryFormData.append("name", newCatTrimmed);
      categoryFormData.append("mode", Modes.NOTES);
      if (category) {
        categoryFormData.append("parent", category);
      }
      await createCategory(categoryFormData);
      return category ? `${category}/${newCatTrimmed}` : newCatTrimmed;
    }
    return category;
  };

  const _buildTemplatePayload = (categoryPath: string) => {
    return applyNoteTemplate(
      selectedTemplateId,
      {
        title: title.trim(),
        category: categoryPath || "Uncategorized",
        username: user?.username || "",
      },
      availableNoteTemplates,
    );
  };

  const _finalizeCreate = async (rawContent: string, isEncrypted = false) => {
    const finalCategoryPath = await _resolveCategoryPath();
    const templatePayload = _buildTemplatePayload(finalCategoryPath);
    const formData = new FormData();
    formData.append("title", templatePayload.title || title.trim());
    formData.append("category", finalCategoryPath);
    formData.append("rawContent", isEncrypted ? rawContent : templatePayload.content);
    formData.append("tags", JSON.stringify(templatePayload.tags));
    const result = await createNote(formData);
    if (result.success) {
      const doc = result.data && isEncrypted
        ? { ...result.data, encrypted: true }
        : result.data;
      onCreated(doc);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;

    if (encryptOnCreate) {
      const templatePayload = _buildTemplatePayload(_previewCategoryPath());
      setEncryptionDraftContent(
        templatePayload.content || ENCRYPTION_PLACEHOLDER_CONTENT,
      );
      setShowEncryptionModal(true);
      return;
    }

    setIsCreating(true);
    try {
      await _finalizeCreate("");
    } finally {
      setIsCreating(false);
    }
  };

  const handleEncryptionSuccess = async (encryptedContent: string) => {
    setShowEncryptionModal(false);
    setIsCreating(true);
    try {
      await _finalizeCreate(encryptedContent, true);
    } finally {
      setIsCreating(false);
    }
  };

  const handleShowNewCategory = (show: boolean) => {
    setShowNewCategory(show);
    if (!show) setNewCategory("");
  };

  const handleTemplateChange = (templateId: string) => {
    const templatePayload = applyNoteTemplate(
      templateId,
      {
        title: title.trim(),
        category: _previewCategoryPath(),
        username: user?.username || "",
      },
      availableNoteTemplates,
    );
    setSelectedTemplateId(templateId);
    if (!title.trim() && templatePayload.title) {
      setTitle(templatePayload.title);
    }
  };

  return (
    <Modal isOpen={true} onClose={onClose} title={t('notes.createNewNote')}>
      <form onSubmit={handleSubmit} className="space-y-6">
        <Input
          ref={titleInputRef}
          id="title"
          name="title"
          label={t('notes.noteTitle')}
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder={t('notes.enterNoteTitle')}
          required
          disabled={isCreating}
          autoFocus
        />

        <CategoryInput
          categories={categories}
          selectedCategory={category}
          onCategoryChange={setCategory}
          newCategory={newCategory}
          onNewCategoryChange={setNewCategory}
          showNewCategory={showNewCategory}
          onShowNewCategoryChange={handleShowNewCategory}
          disabled={isCreating}
        />

        <div className="space-y-2">
          <label htmlFor="noteTemplate" className="text-sm font-medium text-foreground">
            {t('notes.template')}
          </label>
          <Dropdown
            value={selectedTemplateId}
            onChange={handleTemplateChange}
            options={availableNoteTemplates.map((template) => ({
              id: template.id,
              name: template.name || (template.nameKey ? t(template.nameKey) : template.id),
            }))}
            placeholder={t('notes.selectTemplate')}
            disabled={isCreating}
            className="w-full"
          />
          <p className="text-md lg:text-sm text-muted-foreground">
            {selectedTemplate?.description ||
              t(selectedTemplate?.descriptionKey || "notes.templateBlankDescription")}
          </p>
        </div>

        <div className="flex items-center justify-between gap-3">
          <label htmlFor="encryptOnCreate" className="text-sm text-foreground cursor-pointer">
            {t('encryption.encryptNote')}
          </label>
          <Toggle
            id="encryptOnCreate"
            checked={encryptOnCreate}
            onCheckedChange={setEncryptOnCreate}
            disabled={isCreating}
          />
        </div>

        <div className="flex gap-3 pt-4">
          <Button
            type="button"
            variant="outline"
            onClick={onClose}
            disabled={isCreating}
          >{t('common.cancel')}</Button>
          <Button
            type="submit"
            disabled={!title.trim() || isCreating}
            className="flex-1"
          >
            {isCreating ? t('common.creating') : t('common.create')}
          </Button>
        </div>
      </form>

      {showEncryptionModal && encryptionMethod === "pgp" && (
        <PGPEncryptionModal
          isOpen={showEncryptionModal}
          onClose={() => setShowEncryptionModal(false)}
          mode="encrypt"
          noteContent={encryptionDraftContent}
          onSuccess={handleEncryptionSuccess}
        />
      )}
      {showEncryptionModal && encryptionMethod === "xchacha" && (
        <XChaChaEncryptionModal
          isOpen={showEncryptionModal}
          onClose={() => setShowEncryptionModal(false)}
          mode="encrypt"
          noteContent={encryptionDraftContent}
          onSuccess={handleEncryptionSuccess}
        />
      )}
    </Modal>
  );
};
