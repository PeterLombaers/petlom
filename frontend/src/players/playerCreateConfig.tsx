import { Stack, TextInput } from "@mantine/core";
import { useTranslation } from "react-i18next";
import { CreateDialogConfig } from "@/table/CreateButton";
import { createNonEmptyStringValidator } from "@/table/cells";
import FidePlayerSearch from "./FidePlayerSearch";

export type PlayerFormData = { name: string; fide_id: string };

/**
 * The create-player dialog, shared by the player list and the registration screen.
 *
 * Not a data hook: a config factory that is a hook only because it needs
 * `useTranslation`. The FIDE search fills both fields at once; either can still
 * be typed by hand, and an empty FIDE id simply creates a player without one.
 */
export function usePlayerCreateConfig(): CreateDialogConfig<PlayerFormData> {
  const { t } = useTranslation();
  const validatePlayerName = createNonEmptyStringValidator(
    "name",
    t("common.valueRequired"),
  );

  return {
    getInitialFormData: () => ({ name: "", fide_id: "" }),
    validateForm: (formData) => {
      const errors: Record<string, string> = {};
      validatePlayerName(formData.name, errors);
      return errors;
    },
    sanitizeForm: (formData) => ({
      name: formData.name.trim(),
      fide_id: formData.fide_id.trim(),
    }),
    getRequestBody: ({ name, fide_id }) => ({
      name,
      external_ids: fide_id
        ? [{ source: "fide" as const, external_id: fide_id }]
        : [],
    }),
    renderContent: ({ formData, errors, onChange }) => (
      <Stack>
        <FidePlayerSearch
          onSelect={(result) => {
            onChange("name", result.name);
            onChange("fide_id", result.external_id);
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
        <TextInput
          name="player-fide-id"
          id="player-fide-id"
          label={t("player.fideId")}
          value={formData.fide_id}
          error={errors.fide_id || undefined}
          onChange={(e) => onChange("fide_id", e.target.value)}
        />
      </Stack>
    ),
  };
}
