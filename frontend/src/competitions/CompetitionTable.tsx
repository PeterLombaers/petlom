import { CreateDialogConfig } from "@/components/CreateButton";
import EditableTable from "@/components/EditableTable";
import { TextInput } from "@mantine/core";
import { components } from "@/client/schema";
import {
  createLinkTextCell,
  createReadOnlyDateCell,
  createNonEmptyStringValidator,
} from "@/components/cellConfigs";
import { useCompetitions } from "./useCompetitions";

type CompetitionPublic = components["schemas"]["CompetitionPublic"];

const tableCells = {
  name: createLinkTextCell(
    "competition-name",
    "Name",
    (name) => `/competitions/${name}`,
  ),
  created_at: createReadOnlyDateCell(),
  updated_at: createReadOnlyDateCell(),
};

const validateCompetitionName = createNonEmptyStringValidator("name");

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
      label="Name"
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

export default function CompetitionTable() {
  const { competitions, ...queryResult } = useCompetitions();

  const sortedCompetitions = [...(competitions ?? [])].sort((a, b) =>
    b.updated_at.localeCompare(a.updated_at),
  );

  return (
    <EditableTable<CompetitionPublic>
      queryResult={queryResult}
      rows={sortedCompetitions}
      getRowKey={(c) => c.name}
      entityIdField="name"
      cells={tableCells}
      columns={[
        { header: "Name" },
        { header: "Created Date" },
        { header: "Updated Date" },
      ]}
      editConfig={{ validateData, sanitizeData, getRequestBody }}
      deleteConfig={{ entityType: "competition", getEntityName: (c) => c.name }}
      title="Competitions"
      createConfig={{
        entityType: "competition",
        dialogConfig: createDialogConfig,
      }}
      emptyMessage="No competitions yet."
    />
  );
}
