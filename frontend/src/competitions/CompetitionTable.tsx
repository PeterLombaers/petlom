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
  createReadOnlyDateCell,
  createTextCell,
} from "@/components/cellConfigs";

type CompetitionPublic = components["schemas"]["CompetitionPublic"];

const tableCells = {
  name: createTextCell("competition-name", "Name"),
  created_at: createReadOnlyDateCell(),
  updated_at: createReadOnlyDateCell(),
};

const sanitizeCompetitionName = (name: string) => {
  return name.trim();
};

const validateCompetitionName = (
  name: string,
  errors: Record<string, string>
) => {
  if (!name) {
    errors.name = "Name should not be empty";
  }
};

const createDialogConfig: CreateDialogConfig<{ name: string }> = {
  getInitialFormData: () => {
    return {
      name: "",
    };
  },
  validateForm: (formData) => {
    const errors: Record<string, string> = {};
    validateCompetitionName(formData.name, errors);
    return errors;
  },
  sanitizeForm: (formData) => ({
    ...formData,
    name: sanitizeCompetitionName(formData.name),
  }),
  getRequestBody: (formData) => ({ ...formData, type: "simkro" }),
  renderContent: ({ formData, errors, onChange }) => {
    return (
      <TextField
        autoFocus
        fullWidth
        required
        name="competition-name"
        id="competition-name"
        label="Name"
        value={formData.name}
        error={!!errors.name}
        helperText={errors.name}
        onChange={(e) => onChange("name", e.target.value)}
      />
    );
  },
};

export default function CompetitionTable() {
  const [editableId, setEditableId] = useState("");

  const {
    data: competitions,
    error,
    isPending,
    isError,
  } = $api.useQuery("get", "/competitions/");

  const queryClient = useQueryClient();

  const createMutation = $api.useMutation("post", "/competitions/", {
    onSuccess: async () => {
      queryClient.invalidateQueries({ queryKey: ["get", "/competitions/"] });
    },
    onError: async (error) => {
      const errorMessage = formatHTTPValidationError(error);
      console.log(errorMessage);
    },
  });

  const editMutation = $api.useMutation("patch", "/competitions/{name}", {
    onSuccess: async () => {
      queryClient.invalidateQueries({ queryKey: ["get", "/competitions/"] });
    },
    onError: async (error) => {
      const errorMessage = formatHTTPValidationError(error);
      console.log(errorMessage);
    },
  });

  const deleteMutation = $api.useMutation("delete", "/competitions/{name}", {
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["get", "/competitions/"] });
    },
    onError: (error) => {
      const errorMessage = formatHTTPValidationError(error);
      console.error(errorMessage);
    },
  });

  const setIsEditing = (name: string, isEditing: boolean) => {
    setEditableId(isEditing ? name : "");
  };

  const sanitizeData = (competition: CompetitionPublic) => {
    return { ...competition, name: sanitizeCompetitionName(competition.name) };
  };
  const validateData = (competition: CompetitionPublic) => {
    const errors: Record<string, string> = {};
    validateCompetitionName(competition.name, errors);
    return errors;
  };
  const getRequestBody = (competition: CompetitionPublic) => {
    return competition;
  };

  if (isPending) {
    return "Loading...";
  }

  if (isError) {
    const errorMessage = formatHTTPValidationError(error);
    console.log(errorMessage);
    return `An error occured: ${errorMessage}`;
  }

  const sortedCompetitions = [...competitions].sort((a, b) =>
    b.updated_at.localeCompare(a.updated_at)
  );

  return (
    <TableContainer component={Paper}>
      <Table>
        <TableHead>
          <TableRow>
            <TableCell align="right" colSpan={4}>
              <CreateButton
                entityType="competition"
                mutation={createMutation}
                dialogConfig={createDialogConfig}
              />
            </TableCell>
          </TableRow>
          <TableRow>
            <TableCell>Name</TableCell>
            <TableCell>Created Date</TableCell>
            <TableCell>Updated Date</TableCell>
            <TableCell align="right">Actions</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {sortedCompetitions.map((competition) => (
            <EditableRow<CompetitionPublic>
              key={competition.name}
              data={competition}
              isEditing={editableId === competition.name}
              setIsEditing={(isEditing: boolean) =>
                setIsEditing(competition.name, isEditing)
              }
              cells={tableCells}
              entityIdField="name"
              editConfig={{
                editMutation,
                validateData,
                sanitizeData,
                getRequestBody,
              }}
              deleteConfig={{
                deleteMutation,
                entityType: "competition",
                entityNameField: "name",
              }}
            />
          ))}
        </TableBody>
      </Table>
    </TableContainer>
  );
}
