"use client";

import { useState, useEffect } from "react";
import { Button } from "@/app/_components/GlobalComponents/Buttons/Button";
import { Dropdown } from "@/app/_components/GlobalComponents/Dropdowns/Dropdown";
import { Input } from "@/app/_components/GlobalComponents/FormElements/Input";
import { Toggle } from "@/app/_components/GlobalComponents/FormElements/Toggle";
import { ConfirmModal } from "@/app/_components/GlobalComponents/Modals/ConfirmationModals/ConfirmModal";
import { useToast } from "@/app/_providers/ToastProvider";
import { AppSettings } from "@/app/_types";
import {
  getAppSettings,
  updateAppSettings,
} from "@/app/_server/actions/config";
import { deleteAllRepos } from "@/app/_server/actions/history";
import { normalizeEditorAiSettings } from "@/app/_utils/ai-settings-utils";
import { useTranslations } from "next-intl";
import type { EditorAiProvider, EditorAiSettings } from "@/app/_types";

export const EditorSettingsTab = () => {
  const t = useTranslations();
  const { showToast } = useToast();
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [originalHistoryEnabled, setOriginalHistoryEnabled] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);
  const [showDisableHistoryModal, setShowDisableHistoryModal] = useState(false);
  const [openaiApiKey, setOpenaiApiKey] = useState("");
  const [testingProvider, setTestingProvider] = useState<EditorAiProvider | null>(null);

  useEffect(() => {
    const loadSettings = async () => {
      try {
        const result = await getAppSettings();
        if (result.success && result.data) {
          const editorSettings = {
            enableSlashCommands:
              typeof result.data.editor?.enableSlashCommands === "boolean"
                ? result.data.editor?.enableSlashCommands
                : true,
            enableBubbleMenu:
              typeof result.data.editor?.enableBubbleMenu === "boolean"
                ? result.data.editor?.enableBubbleMenu
                : true,
            enableTableToolbar:
              typeof result.data.editor?.enableTableToolbar === "boolean"
                ? result.data.editor?.enableTableToolbar
                : true,
            enableBilateralLinks:
              typeof result.data.editor?.enableBilateralLinks === "boolean"
                ? result.data.editor?.enableBilateralLinks
                : true,
            enableTags:
              typeof result.data.editor?.enableTags === "boolean"
                ? result.data.editor?.enableTags
                : true,
            drawioUrl: result.data.editor?.drawioUrl || "",
            drawioProxyEnabled:
              typeof result.data.editor?.drawioProxyEnabled === "boolean"
                ? result.data.editor?.drawioProxyEnabled
                : false,
            historyEnabled:
              typeof result.data.editor?.historyEnabled === "boolean"
                ? result.data.editor?.historyEnabled
                : false,
            ai: normalizeEditorAiSettings(result.data.editor?.ai),
          };
          setSettings({
            ...result.data,
            editor: editorSettings,
          });
          setOriginalHistoryEnabled(editorSettings.historyEnabled || false);
        } else {
          throw new Error(result.error || t("admin.failedToLoadSettings"));
        }
      } catch (error) {
        showToast({
          type: "error",
          title: t("admin.loadError"),
          message:
            error instanceof Error
              ? error.message
              : t("admin.couldNotFetchSettings"),
        });
      }
    };
    loadSettings();
  }, [showToast]);

  const handleToggleChange = (
    field: keyof AppSettings["editor"],
    value: boolean
  ) => {
    if (!settings) return;

    setSettings((prev) =>
      prev
        ? {
          ...prev,
          editor: {
            ...prev.editor,
            [field]: value,
          },
        }
        : null
    );
    setHasChanges(true);
  };

  const handleInputChange = (
    field: keyof AppSettings["editor"],
    value: string
  ) => {
    if (!settings) return;

    setSettings((prev) =>
      prev
        ? {
          ...prev,
          editor: {
            ...prev.editor,
            [field]: value,
          },
        }
        : null
    );
    setHasChanges(true);
  };

  const handleAiSettingsChange = (
    updater: (aiSettings: EditorAiSettings) => EditorAiSettings
  ) => {
    if (!settings) return;

    setSettings((prev) => {
      if (!prev) return null;
      const aiSettings = normalizeEditorAiSettings(prev.editor.ai);
      return {
        ...prev,
        editor: {
          ...prev.editor,
          ai: updater(aiSettings),
        },
      };
    });
    setHasChanges(true);
  };

  const handleAiProviderToggleChange = (
    provider: EditorAiProvider,
    value: boolean
  ) => {
    handleAiSettingsChange((aiSettings) => ({
      ...aiSettings,
      providers: {
        ...aiSettings.providers,
        [provider]: {
          ...aiSettings.providers[provider],
          enabled: value,
        },
      },
    }));
  };

  const handleAiProviderInputChange = (
    provider: EditorAiProvider,
    field: "defaultModel" | "baseUrl",
    value: string
  ) => {
    handleAiSettingsChange((aiSettings) => ({
      ...aiSettings,
      providers: {
        ...aiSettings.providers,
        [provider]: {
          ...aiSettings.providers[provider],
          [field]: value,
        },
      },
    }));
  };

  const handleAiNumberChange = (
    field: "temperature" | "maxInputCharacters",
    value: string
  ) => {
    handleAiSettingsChange((aiSettings) => ({
      ...aiSettings,
      [field]: Number(value),
    }));
  };

  const handleOpenAiKeyChange = (value: string) => {
    setOpenaiApiKey(value);
    setHasChanges(true);
  };

  const handleTestAiProvider = async (provider: EditorAiProvider) => {
    if (!settings) return;

    setTestingProvider(provider);
    try {
      const aiSettings = normalizeEditorAiSettings(settings.editor.ai);
      const response = await fetch("/api/ai/providers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          provider === "openai"
            ? {
              provider,
              openaiApiKey: openaiApiKey.trim() || undefined,
            }
            : {
              provider,
              baseUrl: aiSettings.providers.ollama.baseUrl,
            }
        ),
      });
      const result = await response.json();

      if (!response.ok || !result.ok) {
        throw new Error(result.message || result.error || t("admin.aiConnectionFailed"));
      }

      showToast({
        type: "success",
        title: t("admin.aiConnectionSuccessful"),
        message: result.message || t("admin.aiConnectionSuccessfulDescription"),
      });
    } catch (error) {
      showToast({
        type: "error",
        title: t("admin.aiConnectionFailed"),
        message:
          error instanceof Error ? error.message : t("admin.unknownErrorOccurred"),
      });
    } finally {
      setTestingProvider(null);
    }
  };

  const handleSave = async () => {
    if (!settings) return;

    const isDisablingHistory =
      originalHistoryEnabled && !settings.editor.historyEnabled;

    if (isDisablingHistory) {
      setShowDisableHistoryModal(true);
      return;
    }

    await performSave();
  };

  const performSave = async (deleteHistory = false) => {
    if (!settings) return;
    setIsSaving(true);
    try {
      if (deleteHistory) {
        const deleteResult = await deleteAllRepos();
        if (!deleteResult.success) {
          throw new Error(deleteResult.error || t("admin.failedToDisableHistory"));
        }
      }

      const formData = new FormData();

      Object.entries(settings).forEach(([key, value]) => {
        if (key === "editor") {
          formData.append(key, JSON.stringify(value));
        } else {
          formData.append(key, String(value));
        }
      });
      if (openaiApiKey.trim()) {
        formData.append("openaiApiKey", openaiApiKey.trim());
      }

      const result = await updateAppSettings(formData);
      if (result.success) {
        if (openaiApiKey.trim()) {
          handleAiSettingsChange((aiSettings) => ({
            ...aiSettings,
            providers: {
              ...aiSettings.providers,
              openai: {
                ...aiSettings.providers.openai,
                keyConfigured: true,
              },
            },
          }));
          setOpenaiApiKey("");
        }
        showToast({
          type: "success",
          title: t("common.success"),
          message: deleteHistory
            ? t("admin.historyDisabled")
            : t("admin.editorSettingsSaved"),
        });
        setHasChanges(false);
        setOriginalHistoryEnabled(settings.editor.historyEnabled || false);
      } else {
        throw new Error(result.error || t("admin.failedToSaveSettings"));
      }
    } catch (error) {
      showToast({
        type: "error",
        title: t("admin.saveError"),
        message:
          error instanceof Error ? error.message : t("admin.unknownErrorOccurred"),
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleConfirmDisableHistory = async () => {
    setShowDisableHistoryModal(false);
    await performSave(true);
  };

  if (!settings) return;

  const aiSettings = normalizeEditorAiSettings(settings.editor.ai);

  return (
    <div className="space-y-6">
      <div className="bg-card border border-border rounded-jotty p-6">
        <div className="space-y-6">
          <div>
            <h3 className="text-lg font-semibold mb-2">{t('editor.editorFeatures')}</h3>
            <p className="text-muted-foreground text-sm">
              {t("admin.configureEditorFeatures")}
            </p>
          </div>

          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <label htmlFor="enableSlashCommands" className="space-y-1 cursor-pointer">
                <div className="text-md lg:text-sm font-medium">{t('editor.slashCommands')}</div>
                <p className="text-md lg:text-xs text-muted-foreground">
                  {t("admin.enableSlashCommandsDescription")}
                </p>
              </label>
              <Toggle
                id="enableSlashCommands"
                checked={settings.editor.enableSlashCommands}
                onCheckedChange={(checked) =>
                  handleToggleChange("enableSlashCommands", checked)
                }
              />
            </div>

            <div className="flex items-center justify-between">
              <label htmlFor="enableBubbleMenu" className="space-y-1 cursor-pointer">
                <div className="text-md lg:text-sm font-medium">{t('editor.bubbleMenu')}</div>
                <p className="text-md lg:text-xs text-muted-foreground">
                  {t("admin.enableBubbleMenuDescription")}
                </p>
              </label>
              <Toggle
                id="enableBubbleMenu"
                checked={settings.editor.enableBubbleMenu}
                onCheckedChange={(checked) =>
                  handleToggleChange("enableBubbleMenu", checked)
                }
              />
            </div>

            <div className="flex items-center justify-between">
              <label htmlFor="enableTableToolbar" className="space-y-1 cursor-pointer">
                <div className="text-md lg:text-sm font-medium">{t('editor.tableToolbar')}</div>
                <p className="text-md lg:text-xs text-muted-foreground">
                  {t("admin.enableTableToolbarDescription")}
                </p>
              </label>
              <Toggle
                id="enableTableToolbar"
                checked={settings.editor.enableTableToolbar}
                onCheckedChange={(checked) =>
                  handleToggleChange("enableTableToolbar", checked)
                }
              />
            </div>

            <div className="flex items-center justify-between">
              <label htmlFor="enableBilateralLinks" className="space-y-1 cursor-pointer">
                <div className="text-md lg:text-sm font-medium">
                  {t("admin.bilateralLinks")}
                  <span className="ml-1 text-sm lg:text-xs text-muted-foreground">
                    {t("admin.experimental")}
                  </span>
                </div>
                <p className="text-md lg:text-xs text-muted-foreground">
                  {t("admin.bilateralLinksDescription")}
                  <span className="mt-1 block text-sm lg:text-xs italic text-muted-foreground">
                    {t("admin.bilateralLinksWarning")}
                  </span>
                </p>
              </label>
              <Toggle
                id="enableBilateralLinks"
                checked={settings.editor.enableBilateralLinks}
                onCheckedChange={(checked) =>
                  handleToggleChange("enableBilateralLinks", checked)
                }
              />
            </div>

            <div className="flex items-center justify-between">
              <label htmlFor="enableTags" className="space-y-1 cursor-pointer">
                <div className="text-md lg:text-sm font-medium">
                  {t("admin.tags")}
                </div>
                <p className="text-md lg:text-xs text-muted-foreground">
                  {t("admin.tagsDescription")}
                </p>
              </label>
              <Toggle
                id="enableTags"
                checked={settings.editor.enableTags || false}
                onCheckedChange={(checked) =>
                  handleToggleChange("enableTags", checked)
                }
              />
            </div>

            <div className="flex items-center justify-between">
              <label htmlFor="historyEnabled" className="space-y-1 cursor-pointer">
                <div className="text-md lg:text-sm font-medium">
                  {t("admin.historyEnabled")}
                </div>
                <p className="text-md lg:text-xs text-muted-foreground">
                  {t("admin.historyDescription")}
                </p>
              </label>
              <Toggle
                id="historyEnabled"
                checked={settings.editor.historyEnabled || false}
                onCheckedChange={(checked) =>
                  handleToggleChange("historyEnabled", checked)
                }
              />
            </div>
          </div>

          <div className="pt-4 border-t border-border">
            <h3 className="text-lg font-semibold mb-2">{t('editor.externalServices')}</h3>
            <p className="text-muted-foreground text-md lg:text-sm mb-4">
              {t("admin.configureExternalServices")}
            </p>

            <div className="space-y-4">
              <div className="border border-border rounded-jotty p-4 space-y-4">
                <label className="block">
                  <div className="text-md lg:text-sm font-medium mb-1">
                    {t("admin.drawioUrl")}
                    <span className="ml-1 text-sm lg:text-xs text-muted-foreground">
                      {t("admin.optional")}
                    </span>
                  </div>
                  <p className="text-md lg:text-xs text-muted-foreground mb-2">
                    {t("admin.drawioUrlDescription")}
                    <span className="mt-1 block text-sm lg:text-xs italic">
                      {t("admin.drawioUrlExample")}
                    </span>
                  </p>
                  <Input
                    id="drawioUrl"
                    type="text"
                    value={settings.editor.drawioUrl || ""}
                    onChange={(e) =>
                      handleInputChange("drawioUrl", e.target.value)
                    }
                    placeholder="https://embed.diagrams.net"
                    className="w-full"
                  />
                </label>

                <div className="flex items-center justify-between">
                  <label htmlFor="drawioProxyEnabled" className="space-y-1 cursor-pointer">
                    <div className="text-md lg:text-sm font-medium">{t("admin.drawioProxyEnabled")}</div>
                    <p className="text-md lg:text-xs text-muted-foreground">
                      {t("admin.drawioProxyEnabledDescription")}
                    </p>
                  </label>
                  <Toggle
                    id="drawioProxyEnabled"
                    checked={settings.editor.drawioProxyEnabled || false}
                    onCheckedChange={(checked) =>
                      handleToggleChange("drawioProxyEnabled", checked)
                    }
                  />
                </div>
              </div>

              <div className="border border-border rounded-jotty p-4 space-y-4">
                <div className="flex items-center justify-between gap-4">
                  <label htmlFor="aiEnabled" className="space-y-1 cursor-pointer">
                    <div className="text-md lg:text-sm font-medium">
                      {t("admin.aiEditorAssistance")}
                    </div>
                    <p className="text-md lg:text-xs text-muted-foreground">
                      {t("admin.aiEditorAssistanceDescription")}
                    </p>
                  </label>
                  <Toggle
                    id="aiEnabled"
                    checked={aiSettings.enabled}
                    onCheckedChange={(checked) =>
                      handleAiSettingsChange((current) => ({
                        ...current,
                        enabled: checked,
                      }))
                    }
                  />
                </div>

                <div className="grid gap-4 md:grid-cols-3">
                  <label className="space-y-2">
                    <span className="text-md lg:text-sm font-medium">
                      {t("admin.aiDefaultProvider")}
                    </span>
                    <Dropdown
                      value={aiSettings.defaultProvider}
                      onChange={(value) =>
                        handleAiSettingsChange((current) => ({
                          ...current,
                          defaultProvider: value as EditorAiProvider,
                        }))
                      }
                      options={[
                        { id: "openai", name: "OpenAI" },
                        { id: "ollama", name: "Ollama" },
                      ]}
                    />
                  </label>

                  <Input
                    id="aiTemperature"
                    type="number"
                    label={t("admin.aiTemperature")}
                    value={String(aiSettings.temperature)}
                    min="0"
                    max="2"
                    onChange={(e) =>
                      handleAiNumberChange("temperature", e.target.value)
                    }
                    description={t("admin.aiTemperatureDescription")}
                  />

                  <Input
                    id="aiMaxInputCharacters"
                    type="number"
                    label={t("admin.aiMaxInputCharacters")}
                    value={String(aiSettings.maxInputCharacters)}
                    min="500"
                    max="50000"
                    onChange={(e) =>
                      handleAiNumberChange("maxInputCharacters", e.target.value)
                    }
                    description={t("admin.aiMaxInputCharactersDescription")}
                  />
                </div>

                <div className="grid gap-4 lg:grid-cols-2">
                  <div className="border border-border rounded-jotty p-4 space-y-4">
                    <div className="flex items-center justify-between gap-4">
                      <label htmlFor="openaiEnabled" className="space-y-1 cursor-pointer">
                        <div className="text-md lg:text-sm font-medium">
                          {t("admin.aiOpenAiProvider")}
                        </div>
                        <p className="text-md lg:text-xs text-muted-foreground">
                          {t("admin.aiOpenAiProviderDescription")}
                        </p>
                      </label>
                      <Toggle
                        id="openaiEnabled"
                        checked={aiSettings.providers.openai.enabled}
                        onCheckedChange={(checked) =>
                          handleAiProviderToggleChange("openai", checked)
                        }
                      />
                    </div>

                    <Input
                      id="openaiDefaultModel"
                      type="text"
                      label={t("admin.aiDefaultModel")}
                      value={aiSettings.providers.openai.defaultModel}
                      onChange={(e) =>
                        handleAiProviderInputChange(
                          "openai",
                          "defaultModel",
                          e.target.value,
                        )
                      }
                      placeholder="gpt-4o-mini"
                    />

                    <Input
                      id="openaiApiKey"
                      type="password"
                      label={t("admin.aiOpenAiApiKey")}
                      value={openaiApiKey}
                      onChange={(e) => handleOpenAiKeyChange(e.target.value)}
                      placeholder={
                        aiSettings.providers.openai.keyConfigured
                          ? t("admin.aiOpenAiKeyConfiguredPlaceholder")
                          : "sk-..."
                      }
                      description={
                        openaiApiKey.trim()
                          ? t("admin.aiOpenAiKeyWillBeSaved")
                          : aiSettings.providers.openai.keyConfigured
                            ? t("admin.aiOpenAiKeyConfigured")
                            : t("admin.aiOpenAiKeyMissing")
                      }
                      autoComplete="off"
                    />

                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => handleTestAiProvider("openai")}
                      disabled={testingProvider !== null}
                    >
                      {testingProvider === "openai"
                        ? t("admin.aiTestingConnection")
                        : t("admin.aiTestConnection")}
                    </Button>
                  </div>

                  <div className="border border-border rounded-jotty p-4 space-y-4">
                    <div className="flex items-center justify-between gap-4">
                      <label htmlFor="ollamaEnabled" className="space-y-1 cursor-pointer">
                        <div className="text-md lg:text-sm font-medium">
                          {t("admin.aiOllamaProvider")}
                        </div>
                        <p className="text-md lg:text-xs text-muted-foreground">
                          {t("admin.aiOllamaProviderDescription")}
                        </p>
                      </label>
                      <Toggle
                        id="ollamaEnabled"
                        checked={aiSettings.providers.ollama.enabled}
                        onCheckedChange={(checked) =>
                          handleAiProviderToggleChange("ollama", checked)
                        }
                      />
                    </div>

                    <Input
                      id="ollamaBaseUrl"
                      type="text"
                      label={t("admin.aiOllamaBaseUrl")}
                      value={aiSettings.providers.ollama.baseUrl}
                      onChange={(e) =>
                        handleAiProviderInputChange(
                          "ollama",
                          "baseUrl",
                          e.target.value,
                        )
                      }
                      placeholder="http://localhost:11434"
                      description={t("admin.aiOllamaBaseUrlDescription")}
                    />

                    <Input
                      id="ollamaDefaultModel"
                      type="text"
                      label={t("admin.aiDefaultModel")}
                      value={aiSettings.providers.ollama.defaultModel}
                      onChange={(e) =>
                        handleAiProviderInputChange(
                          "ollama",
                          "defaultModel",
                          e.target.value,
                        )
                      }
                      placeholder="llama3.1"
                    />

                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => handleTestAiProvider("ollama")}
                      disabled={testingProvider !== null}
                    >
                      {testingProvider === "ollama"
                        ? t("admin.aiTestingConnection")
                        : t("admin.aiTestConnection")}
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="flex justify-end">
        <Button
          onClick={handleSave}
          disabled={!hasChanges || isSaving}
          className="min-w-24"
        >
          {isSaving ? t("admin.saving") : t("admin.saveChanges")}
        </Button>
      </div>

      <ConfirmModal
        isOpen={showDisableHistoryModal}
        onClose={() => setShowDisableHistoryModal(false)}
        onConfirm={handleConfirmDisableHistory}
        title={t("admin.disableHistory")}
        message={t("admin.disableHistoryWarning")}
        confirmText={t("common.disable")}
        cancelText={t("common.cancel")}
        variant="destructive"
      />
    </div>
  );
};
