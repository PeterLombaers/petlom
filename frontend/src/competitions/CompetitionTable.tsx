import { CreateDialogConfig } from "@/components/CreateButton";
import EditableTable from "@/components/EditableTable";
import { TextInput } from "@mantine/core";
import { components } from "@/client/schema";
import {
  createLinkTextCell,
  createReadOnlyDateCell,
  createNonEmptyStringValidator,
} from "@/components/cellConfigs";
import { useTranslation } from "react-i18next";
import { useCompetitions } from "./useCompetitions";

type CompetitionPublic = components["schemas"]["CompetitionPublic"];

export default function CompetitionTable() {
  const { t } = useTranslation();
  const queryResult = useCompetitions();

  const validateCompetitionName = createNonEmptyStringValidator(
    "name",
    t("common.valueRequired"),
  );

  const createDialogConfig: CreateDialogConfig<{ name: string }> = {
    getInitialFormData: () => ({ name: "" }),
    validateForm: (formData) => {
      const errors: Record<string, string> = {};
      validateCompetitionName(formData.name, errors);
      return errors;
    },
    sanitizeForm: (formData) => ({ ...formData, name: formData.name.trim() }),
    getRequestBody: (formData) => ({ ...formData, type: "simkro" }),
    renderContent: ({ formData, errors, onChange }) => (
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
    ),
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
