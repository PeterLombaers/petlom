import { CreateDialogConfig } from "@/components/CreateButton";
import EditableTable from "@/components/EditableTable";
import { TextInput } from "@mantine/core";
import { components } from "@/client/schema";
import {
  createReadOnlyNumberCell,
  createTextCell,
  createNonEmptyStringValidator,
} from "@/components/cellConfigs";
import { usePlayers } from "./usePlayers";

type PlayerPublic = components["schemas"]["PlayerPublic"];

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
  const queryResult = usePlayers();

  return (
    <EditableTable<PlayerPublic>
      queryResult={queryResult}
      entityType="player"
      columns={[
        {
          field: "id",
          cell: createReadOnlyNumberCell(),
          isId: true,
          hidden: true,
        },
        { field: "name", cell: createTextCell("player-name", "Name") },
      ]}
      sort={(a, b) => a.name.localeCompare(b.name)}
      createConfig={createDialogConfig}
      editConfig={{ validateData, sanitizeData, getRequestBody }}
      deleteConfig={{ getEntityName: (p) => p.name }}
    />
  );
}
