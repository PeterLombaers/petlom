import { $api, formatHTTPValidationError } from "@/client/api";
import { CreateButton, CreateDialogConfig } from "@/components/CreateButton";
import EditableRow from "@/components/EditableRow";
import {
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
} from "@mui/material";
import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { components } from "@/client/schema";
import {
  createReadOnlyNumberCell,
  createTextCell,
  createNonEmptyStringValidator,
} from "@/components/cellConfigs";

type PlayerPublic = components["schemas"]["PlayerPublic"];

const tableCells = {
  id: createReadOnlyNumberCell(),
  name: createTextCell("player-name", "Name"),
};

const validatePlayerName = createNonEmptyStringValidator("name");

const createDialogConfig: CreateDialogConfig<{ name: string }> = {
  getInitialFormData: () => {
    return {
      name: "",
    };
  },
  validateForm: (formData) => {
    const errors: Record<string, string> = {};
    validatePlayerName(formData.name, errors);
    return errors;
  },
  sanitizeForm: (formData) => ({
    ...formData,
    name: formData.name.trim(),
  }),
  getRequestBody: (formData) => ({ ...formData }),
  renderContent: ({ formData, errors, onChange }) => {
    return (
      <TextField
        autoFocus
        fullWidth
        required
        name="player-name"
        id="player-name"
        label="Name"
        value={formData.name}
        error={!!errors.name}
        helperText={errors.name}
        onChange={(e) => onChange("name", e.target.value)}
      />
    );
  },
};

export default function PlayerTable() {
  const [editableId, setEditableId] = useState(-1);

  const {
    data: players,
    error,
    isPending,
    isError,
  } = $api.useQuery("get", "/players/");

  const queryClient = useQueryClient();

  const createMutation = $api.useMutation("post", "/players/", {
    onSuccess: async () => {
      queryClient.invalidateQueries({ queryKey: ["get", "/players/"] });
    },
    onError: async (error) => {
      const errorMessage = formatHTTPValidationError(error);
      console.log(errorMessage);
    },
  });

  const editMutation = $api.useMutation("patch", "/players/{id}/", {
    onSuccess: async () => {
      queryClient.invalidateQueries({ queryKey: ["get", "/players/"] });
    },
    onError: async (error) => {
      const errorMessage = formatHTTPValidationError(error);
      console.log(errorMessage);
    },
  });

  const deleteMutation = $api.useMutation("delete", "/players/{id}/", {
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["get", "/players/"] });
    },
    onError: (error) => {
      const errorMessage = formatHTTPValidationError(error);
      console.error(errorMessage);
    },
  });

  const setIsEditing = (playerId: number, isEditing: boolean) => {
    setEditableId(isEditing ? playerId : -1);
  };

  const sanitizeData = (player: PlayerPublic) => {
    return { ...player, name: player.name.trim() };
  };
  const validateData = (player: PlayerPublic) => {
    const errors: Record<string, string> = {};
    validatePlayerName(player.name, errors);
    return errors;
  };
  const getRequestBody = (player: PlayerPublic) => {
    return player;
  };

  if (isPending) {
    return "Loading...";
  }

  if (isError) {
    const errorMessage = formatHTTPValidationError(error);
    console.log(errorMessage);
    return `An error occured: ${errorMessage}`;
  }

  const sortedPlayers = [...players].sort((a, b) =>
    a.name.localeCompare(b.name)
  );

  return (
    <TableContainer component={Paper}>
      <Table>
        <TableHead>
          <TableRow>
            <TableCell
              align="right"
              // Number of columns is number of configured cells plus the actions column.
              colSpan={Object.keys(tableCells).length + 1}
            >
              <CreateButton
                entityType="player"
                mutation={createMutation}
                dialogConfig={createDialogConfig}
              />
            </TableCell>
          </TableRow>
          <TableRow>
            <TableCell>ID</TableCell>
            <TableCell>Name</TableCell>
            <TableCell align="right">Actions</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {sortedPlayers.map((player) => (
            <EditableRow<PlayerPublic>
              key={player.id}
              data={player}
              isEditing={editableId === player.id}
              setIsEditing={(isEditing: boolean) =>
                setIsEditing(player.id, isEditing)
              }
              cells={tableCells}
              entityIdField="id"
              editConfig={{
                editMutation,
                validateData,
                sanitizeData,
                getRequestBody,
              }}
              deleteConfig={{
                deleteMutation,
                entityType: "player",
                entityNameField: "name",
              }}
            />
          ))}
        </TableBody>
      </Table>
    </TableContainer>
  );
}
