import { Grid2 as Grid, Container, TextField } from "@mui/material";
import { Competition } from "./Competition";
import { CreateButton, CreateDialogConfig } from "@components/CreateButton";
import { $api, formatHTTPValidationError } from "@client/api";
import { useQueryClient } from "@tanstack/react-query";

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

export const CompetitionList = () => {
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

  if (isPending || !competitions) return "Loading...";

  if (isError) {
    console.log(error.detail);
    return `An error occured: ${error.detail}`;
  }

  return (
    <Container maxWidth="md">
      <Grid container spacing={2}>
        {competitions.map((competition) => {
          return (
            <Grid size={4} key={competition.name}>
              <Competition {...competition} />
            </Grid>
          );
        })}
      </Grid>
      <CreateButton
        entityType="competition"
        mutation={createMutation}
        dialogConfig={createDialogConfig}
      />
    </Container>
  );
};
