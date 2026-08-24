import { useState } from "react";
import { SegmentedControl, Stack, TextInput } from "@mantine/core";
import { useTranslation } from "react-i18next";
import { components } from "@client/schema";
import { CreateDialogConfig } from "@/table/CreateButton";
import { createNonEmptyStringValidator } from "@/table/cells";
import ExternalPlayerSearch from "./ExternalPlayerSearch";
import { EXTERNAL_SOURCES } from "./external";

type ExternalRatingSource = components["schemas"]["ExternalRatingSource"];

export type PlayerFormData = {
  name: string;
  fide_id: string;
  knsb_id: string;
};

/**
 * The create-player dialog, shared by the player list and the registration screen.
 *
 * Not a data hook: a config factory that is a hook only because it needs
 * `useTranslation` and the state of the source picker. A search fills the name
 * and the id of the source it searched; every field can still be typed by
 * hand, and a player created without any external id is fine.
 *
 * `initialName` seeds the name field, so a caller that already knows what the
 * player is called (the import modal, from the sign-up sheet) does not make the
 * moderator retype it.
 */
export function usePlayerCreateConfig(
  initialName = "",
): CreateDialogConfig<PlayerFormData> {
  const { t } = useTranslation();
  const [searchSource, setSearchSource] =
    useState<ExternalRatingSource>("fide");
  const validatePlayerName = createNonEmptyStringValidator(
    "name",
    t("common.valueRequired"),
  );

  return {
    getInitialFormData: () => ({ name: initialName, fide_id: "", knsb_id: "" }),
    validateForm: (formData) => {
      const errors: Record<string, string> = {};
      validatePlayerName(formData.name, errors);
      return errors;
    },
    sanitizeForm: (formData) => ({
      name: formData.name.trim(),
      fide_id: formData.fide_id.trim(),
      knsb_id: formData.knsb_id.trim(),
    }),
    getRequestBody: (formData) => ({
      name: formData.name,
      external_ids: EXTERNAL_SOURCES.filter(
        (source) => formData[`${source}_id`],
      ).map((source) => ({
        source,
        external_id: formData[`${source}_id`],
      })),
    }),
    renderContent: ({ formData, errors, onChange }) => (
      <Stack>
        <SegmentedControl
          aria-label={t("player.searchSourceLabel")}
          value={searchSource}
          onChange={(value) => setSearchSource(value as ExternalRatingSource)}
          data={EXTERNAL_SOURCES.map((source) => ({
            value: source,
            label: t(`externalSource.${source}`),
          }))}
        />
        <ExternalPlayerSearch
          source={searchSource}
          onSelect={(result) => {
            onChange("name", result.name);
            onChange(`${searchSource}_id`, result.external_id);
          }}
        />
        <TextInput
          required
          name="player-name"
          id="player-name"
          label={t("common.name")}
          value={formData.name}
          error={errors.name || undefined}
          onChange={(e) => onChange("name", e.target.value)}
        />
        {EXTERNAL_SOURCES.map((source) => (
          <TextInput
            key={source}
            name={`player-${source}-id`}
            id={`player-${source}-id`}
            label={t("player.sourceId", {
              source: t(`externalSource.${source}`),
            })}
            value={formData[`${source}_id`]}
            error={errors[`${source}_id`] || undefined}
            onChange={(e) => onChange(`${source}_id`, e.target.value)}
          />
        ))}
      </Stack>
    ),
  };
}
