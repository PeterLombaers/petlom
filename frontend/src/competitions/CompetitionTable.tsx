import { $api, formatHTTPValidationError } from "@/client/api";
import { CreateButton, CreateDialogConfig } from "@/components/CreateButton";
import DeleteButton from "@/components/DeleteButton";
import EditButton from "@/components/EditButton";
import {
  Paper,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
} from "@mui/material";
import { useQueryClient } from "@tanstack/react-query";

const formatDate = (dateString: string) => {
  return new Date(dateString).toLocaleDateString();
};

const createDialogConfig: CreateDialogConfig<{ name: string }> = {
  getInitialFormData: () => {
    return {
      name: "",
    };
  },
  validateForm: (formData) => {
    const errors: Record<string, string> = {};
    if (!formData.name) {
      errors.name = "Name should not be empty";
    }
    return errors;
  },
  sanitizeForm: (formData) => ({ name: formData.name.trim() }),
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

  const deleteMutation = $api.useMutation("delete", "/competitions/{name}", {
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["get", "/competitions/"] });
    },
    onError: (error) => {
      const errorMessage = formatHTTPValidationError(error);
      console.error(errorMessage);
    },
  });

  if (isPending) {
    return "Loading...";
  }

  if (isError) {
    const errorMessage = formatHTTPValidationError(error);
    console.log(errorMessage);
    return `An error occured: ${errorMessage}`;
  }

  const sortedCompetitions = [...competitions].sort((a, b) =>
    a.updated_at.localeCompare(b.updated_at)
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
            <TableRow key={competition.name}>
              <TableCell>{competition.name}</TableCell>
              <TableCell>{formatDate(competition.created_at)}</TableCell>
              <TableCell>{formatDate(competition.updated_at)}</TableCell>
              <TableCell align="right">
                <Stack direction="row" justifyContent="flex-end">
                  <EditButton />
                  <DeleteButton
                    entityId={competition.name}
                    entityName={competition.name}
                    entityType="competition"
                    mutation={deleteMutation}
                  />
                </Stack>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </TableContainer>
  );
}
