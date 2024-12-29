import { Grid2 as Grid, Container } from "@mui/material";
import { Competition } from "./Competition";
import { apiClient } from "./utils";
import { components } from "./client/schema";
import { useQuery } from "@tanstack/react-query";

type CompetitionPublic = components["schemas"]["CompetitionPublic"];

export const CompetitionList = () => {
  const getCompetitions = async (): Promise<CompetitionPublic[]> => {
    const { data, error } = await apiClient.GET("/competitions/");
    if (error) {
      throw new Error(`Error in fetching competitions: ${error.detail}`);
    }
    return data;
  };

  const {
    data: competitions,
    error,
    isPending,
    isError,
  } = useQuery({
    queryKey: ["GET", "/competitions/"],
    queryFn: getCompetitions,
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
    </Container>
  );
};
