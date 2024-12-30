import { Grid2 as Grid, Container } from "@mui/material";
import { Competition } from "./Competition";
import { useQuery } from "@tanstack/react-query";
import CreateButton from "./CreateButton";
import { getCompetitionList } from "../client/api";

export const CompetitionList = () => {
  const {
    data: competitions,
    error,
    isPending,
    isError,
  } = useQuery({
    queryKey: ["/competitions/", "GET"],
    queryFn: getCompetitionList,
  });

  if (isPending || !competitions) return "Loading...";

  if (isError) {
    console.log(error.message);
    return `An error occured: ${error.message}`;
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
