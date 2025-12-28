import { Grid2 as Grid, Container } from "@mui/material";
import { Competition } from "./Competition";
import CreateButton from "./CreateButton";
import { $api } from "@client/api";

export const CompetitionList = () => {
  const {
    data: competitions,
    error,
    isPending,
    isError,
  } = $api.useQuery("get", "/competitions/");

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
      <CreateButton />
    </Container>
  );
};
