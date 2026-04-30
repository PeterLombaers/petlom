import { formatHTTPValidationError } from "@/client/api";
import { CreateButton, CreateDialogConfig } from "@/components/CreateButton";
import EditableRow from "@/components/EditableRow";
import { Paper, Table, TextInput } from "@mantine/core";
import { ErrorState } from "@/components/ErrorState";
import { LoadingState } from "@/components/LoadingState";
import { useState } from "react";
import { components } from "@/client/schema";
import {
  createLinkTextCell,
  createReadOnlyDateCell,
  createNonEmptyStringValidator,
} from "@/components/cellConfigs";
import { useCompetitions } from "./useCompetitions";
import { useAuth } from "@/auth";

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

export default function CompetitionTable() {
  const [editableId, setEditableId] = useState("");
  const { isModerator } = useAuth();
  const {
    competitions,
    error,
    isPending,
    isError,
    createMutation,
    editMutation,
    deleteMutation,
  } = useCompetitions();

  const setIsEditing = (name: string, isEditing: boolean) => {
    setEditableId(isEditing ? name : "");
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

  if (isPending) return <LoadingState />;
  if (isError) return <ErrorState message={formatHTTPValidationError(error)} />;

  const sortedCompetitions = [...(competitions ?? [])].sort((a, b) =>
    b.updated_at.localeCompare(a.updated_at),
  );

  const nCols = Object.keys(tableCells).length + (isModerator ? 1 : 0);

  return (
    <Paper withBorder>
      <Table>
        <Table.Thead>
          {isModerator && (
            <Table.Tr>
              <Table.Td colSpan={nCols}>
                <CreateButton
                  entityType="competition"
                  mutation={createMutation}
                  dialogConfig={createDialogConfig}
                />
              </Table.Td>
            </Table.Tr>
          )}
          <Table.Tr>
            <Table.Th>Name</Table.Th>
            <Table.Th>Created Date</Table.Th>
            <Table.Th>Updated Date</Table.Th>
            {isModerator && <Table.Th>Actions</Table.Th>}
          </Table.Tr>
        </Table.Thead>
        <Table.Tbody>
          {sortedCompetitions.length > 0 ? (
            sortedCompetitions.map((competition) => (
              <EditableRow<CompetitionPublic>
                key={competition.name}
                data={competition}
                isEditing={editableId === competition.name}
                setIsEditing={(isEditing: boolean) =>
                  setIsEditing(competition.name, isEditing)
                }
                cells={tableCells}
                entityIdField="name"
                editConfig={
                  isModerator
                    ? { editMutation, validateData, sanitizeData, getRequestBody }
                    : undefined
                }
                deleteConfig={
                  isModerator
                    ? {
                        deleteMutation,
                        entityType: "competition",
                        entityNameField: "name",
                      }
                    : undefined
                }
              />
            ))
          ) : (
            <Table.Tr>
              <Table.Td colSpan={nCols} c="dimmed" ta="center">No competitions yet.</Table.Td>
            </Table.Tr>
          )}
        </Table.Tbody>
      </Table>
    </Paper>
  );
}
