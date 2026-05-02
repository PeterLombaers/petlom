import { formatHTTPValidationError } from "@/client/api";
import { CreateDialogConfig } from "@/components/CreateButton";
import EditableTable from "@/components/EditableTable";
import { ErrorState } from "@/components/ErrorState";
import { LoadingState } from "@/components/LoadingState";
import { TextInput } from "@mantine/core";
import { components } from "@/client/schema";
import {
  createReadOnlyNumberCell,
  createTextCell,
  createNonEmptyStringValidator,
} from "@/components/cellConfigs";
import { usePlayers } from "./usePlayers";
import { useAuth } from "@/auth";

type PlayerPublic = components["schemas"]["PlayerPublic"];

const tableCells = {
  id: createReadOnlyNumberCell(),
  name: createTextCell("player-name", "Name"),
};

const validatePlayerName = createNonEmptyStringValidator("name");

const createDialogConfig: CreateDialogConfig<{ name: string }> = {
  getInitialFormData: () => ({ name: "" }),
  validateForm: (formData) => {
    const errors: Record<string, string> = {};
    validatePlayerName(formData.name, errors);
    return errors;
  },
  sanitizeForm: (formData) => ({ ...formData, name: formData.name.trim() }),
  getRequestBody: (formData) => ({ ...formData }),
  renderContent: ({ formData, errors, onChange }) => (
    <TextInput
      autoFocus
      required
      name="player-name"
      id="player-name"
      label="Name"
      value={formData.name}
      error={errors.name || undefined}
      onChange={(e) => onChange("name", e.target.value)}
    />
  ),
};

const sanitizeData = (player: PlayerPublic) => ({
  ...player,
  name: player.name.trim(),
});
const validateData = (player: PlayerPublic) => {
  const errors: Record<string, string> = {};
  validatePlayerName(player.name, errors);
  return errors;
};
const getRequestBody = (player: PlayerPublic) => player;

export default function PlayerTable() {
  const { isModerator } = useAuth();
  const {
    players,
    error,
    isPending,
    isError,
    createMutation,
    editMutation,
    deleteMutation,
  } = usePlayers();

  if (isPending) return <LoadingState />;
  if (isError) return <ErrorState message={formatHTTPValidationError(error)} />;

  const sortedPlayers = [...(players ?? [])].sort((a, b) =>
    a.name.localeCompare(b.name),
  );

  return (
    <EditableTable<PlayerPublic>
      rows={sortedPlayers}
      getRowKey={(p) => p.id}
      entityIdField="id"
      cells={tableCells}
      columns={[{ header: "ID" }, { header: "Name" }]}
      editConfig={
        isModerator
          ? { editMutation, validateData, sanitizeData, getRequestBody }
          : undefined
      }
      deleteConfig={
        isModerator
          ? {
              deleteMutation,
              entityType: "player",
              getEntityName: (p) => p.name,
            }
          : undefined
      }
      title={isModerator ? "Players" : undefined}
      createConfig={
        isModerator
          ? {
              entityType: "player",
              mutation: createMutation,
              dialogConfig: createDialogConfig,
            }
          : undefined
      }
      emptyMessage="No players yet."
    />
  );
}
