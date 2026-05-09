import { CreateDialogConfig } from "@/components/CreateButton";
import EditableTable from "@/components/EditableTable";
import {
  NumberInput,
  Select,
  Stack,
  Textarea,
  TextInput,
} from "@mantine/core";
import { components } from "@/client/schema";
import {
  createLinkTextCell,
  createReadOnlyDateCell,
  createNonEmptyStringValidator,
} from "@/components/cellConfigs";
import { useTranslation } from "react-i18next";
import { useCompetitions } from "./useCompetitions";

type CompetitionPublic = components["schemas"]["CompetitionPublic"];
type SchemaRatingCreate = components["schemas"]["CompetitionRatingTypeCreate"];

// algorithm_config is a JSON string in the form (textarea).
type RatingFormData = Omit<SchemaRatingCreate, "algorithm_config" | "default_initial_rating"> & {
  algorithm_config: string;
  default_initial_rating: number | null;
};

type CompetitionFormData = {
  name: string;
  rating_type: RatingFormData;
};

export default function CompetitionTable() {
  const { t } = useTranslation();
  const queryResult = useCompetitions();

  const validateCompetitionName = createNonEmptyStringValidator(
    "name",
    t("common.valueRequired"),
  );

  const createDialogConfig: CreateDialogConfig<CompetitionFormData> = {
    getInitialFormData: () => ({
      name: "",
      rating_type: { algorithm: "elo", default_initial_rating: null, algorithm_config: "" },
    }),
    validateForm: (formData) => {
      const errors: Record<string, string> = {};
      validateCompetitionName(formData.name, errors);
      return errors;
    },
    sanitizeForm: (formData) => ({ ...formData, name: formData.name.trim() }),
    getRequestBody: (formData) => {
      const rt = formData.rating_type;
      return {
        name: formData.name,
        type: "simkro" as const,
        rating_type: {
          algorithm: rt.algorithm,
          default_initial_rating: rt.default_initial_rating,
          algorithm_config: rt.algorithm_config.trim()
            ? (() => { try { return JSON.parse(rt.algorithm_config); } catch { return null; } })()
            : null,
        },
      };
    },
    renderContent: ({ formData, errors, onChange }) => {
      const rt = formData.rating_type;
      const setRating = (patch: Partial<RatingFormData>) =>
        onChange("rating_type", { ...rt, ...patch });
      return (
        <Stack>
          <TextInput
            autoFocus
            required
            name="competition-name"
            id="competition-name"
            label={t("common.name")}
            value={formData.name}
            error={errors.name || undefined}
            onChange={(e) => onChange("name", e.target.value)}
          />
          <Select
            label={t("rating.algorithm")}
            data={[{ value: "elo", label: "ELO" }]}
            value={rt.algorithm}
            onChange={(v) => setRating({ algorithm: (v ?? "elo") as "elo" })}
          />
          <NumberInput
            label={t("rating.defaultInitialRating")}
            value={rt.default_initial_rating ?? ""}
            onChange={(v) => setRating({ default_initial_rating: typeof v === "number" ? v : null })}
            min={0}
            allowDecimal={false}
          />
          <Textarea
            label={t("rating.algorithmConfig")}
            value={rt.algorithm_config}
            onChange={(e) => setRating({ algorithm_config: e.target.value })}
            placeholder='{"k_factor": 30}'
            rows={2}
          />
        </Stack>
      );
    },
  };

  const sanitizeData = (competition: CompetitionPublic) => ({
    ...competition,
    name: competition.name.trim(),
  });
  const validateData = (competition: CompetitionPublic) => {
    const errors: Record<string, string> = {};
    validateCompetitionName(competition.name, errors);
    return errors;
  };
  const getRequestBody = (competition: CompetitionPublic) => competition;

  return (
    <EditableTable<CompetitionPublic>
      queryResult={queryResult}
      entityType="competition"
      columns={[
        {
          field: "name",
          cell: createLinkTextCell(
            "competition-name",
            t("common.name"),
            (name) => `/competitions/${name}`,
          ),
          isId: true,
        },
        {
          field: "created_at",
          cell: createReadOnlyDateCell(),
          header: t("competition.createdDate"),
        },
        {
          field: "updated_at",
          cell: createReadOnlyDateCell(),
          header: t("competition.updatedDate"),
        },
      ]}
      sort={(a, b) => b.updated_at.localeCompare(a.updated_at)}
      createConfig={createDialogConfig}
      editConfig={{ validateData, sanitizeData, getRequestBody }}
      deleteConfig={{ getEntityName: (c) => c.name }}
    />
  );
}
