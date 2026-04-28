"use client";

import { useEffect, useMemo, useState } from "react";
import {
  AiBeautifyIcon,
  ArrowDown01Icon,
  Tick02Icon,
} from "hugeicons-react";
import { Button } from "@/app/_components/GlobalComponents/Buttons/Button";
import { ToolbarDropdown } from "./ToolbarDropdown";
import type { EditorAiModelSelection, EditorAiProvider } from "@/app/_types";
import { useTranslations } from "next-intl";

interface AiModelOption {
  provider: EditorAiProvider;
  providerName: string;
  model: string;
}

interface AiProviderMetadata {
  aiEnabled: boolean;
  defaultProvider: EditorAiProvider;
  providers: Array<{
    id: EditorAiProvider;
    enabled: boolean;
    configured: boolean;
    defaultModel: string;
    models: Array<{ id: string; name: string }>;
  }>;
}

interface AiModelDropdownProps {
  value: EditorAiModelSelection | null;
  onChange: (selection: EditorAiModelSelection) => void;
}

/**
 * @todo fccview is telling you to review this AI generated code
 * and make sure it's up to standards, reusable, modular and consistent with
 * the rest of the codebase.
 */
export const AiModelDropdown = ({ value, onChange }: AiModelDropdownProps) => {
  const t = useTranslations();
  const [metadata, setMetadata] = useState<AiProviderMetadata | null>(null);

  useEffect(() => {
    let cancelled = false;

    fetch("/api/ai/providers")
      .then((response) => (response.ok ? response.json() : null))
      .then((data) => {
        if (!cancelled && data) setMetadata(data);
      })
      .catch(() => {
        if (!cancelled) setMetadata(null);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const options = useMemo<AiModelOption[]>(() => {
    if (!metadata?.aiEnabled) return [];

    return metadata.providers
      .filter((provider) => provider.enabled && provider.configured)
      .flatMap((provider) => {
        const models = provider.models.length
          ? provider.models
          : [{ id: provider.defaultModel, name: provider.defaultModel }];

        return models
          .filter((model) => model.id)
          .map((model) => ({
            provider: provider.id,
            providerName: provider.id === "openai" ? "OpenAI" : "Ollama",
            model: model.id,
          }));
      });
  }, [metadata]);

  useEffect(() => {
    if (!options.length) return;

    const currentIsAvailable = options.some(
      (option) => option.provider === value?.provider && option.model === value?.model,
    );
    if (!currentIsAvailable) {
      const preferred =
        options.find((option) => option.provider === metadata?.defaultProvider) ||
        options[0];
      onChange({ provider: preferred.provider, model: preferred.model });
    }
  }, [metadata?.defaultProvider, onChange, options, value?.model, value?.provider]);

  if (!options.length) return null;

  const activeOption =
    options.find(
      (option) => option.provider === value?.provider && option.model === value?.model,
    ) || options[0];

  const trigger = (
    <Button
      variant="ghost"
      size="sm"
      onMouseDown={(e) => e.preventDefault()}
      className="flex items-center gap-1"
      title={t("editor.aiModel")}
    >
      <AiBeautifyIcon className="h-4 w-4" />
      <span className="hidden xl:inline max-w-[120px] truncate">
        {activeOption.providerName}: {activeOption.model}
      </span>
      <ArrowDown01Icon className="h-3 w-3" />
    </Button>
  );

  return (
    <ToolbarDropdown trigger={trigger} direction="right">
      <div className="flex flex-col py-1 overflow-y-auto">
        {options.map((option) => {
          const selected =
            option.provider === activeOption.provider &&
            option.model === activeOption.model;

          return (
            <button
              key={`${option.provider}:${option.model}`}
              className={`w-full flex items-center justify-between gap-4 px-3 py-2 text-left hover:bg-accent text-md lg:text-sm ${selected ? "bg-accent" : ""}`}
              onClick={(e) => {
                e.stopPropagation();
                onChange({ provider: option.provider, model: option.model });
              }}
            >
              <span className="min-w-0 truncate">
                {option.providerName}: {option.model}
              </span>
              {selected && <Tick02Icon className="h-4 w-4 text-primary" />}
            </button>
          );
        })}
      </div>
    </ToolbarDropdown>
  );
};
