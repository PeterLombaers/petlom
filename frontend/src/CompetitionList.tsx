import { Grid2 as Grid } from "@mui/material";
import { Competition } from "./Competition";
import { apiClient } from "./utils";

export const CompetitionList = () => {
  const { data, error, isLoading } = apiClient.useQuery(
    "get",
    "/competitions/"
  );

  if (isLoading || !data) return "Loading...";

  if (error) {
    console.log(error);
    return `An error occured: ${error}`;
  }

  return (
    <Grid container spacing={2}>
      {data.map((competition) => {
        return (
          <Grid size={4} key={competition.name}>
            <Competition {...competition} />
          </Grid>
        );
      })}
    </Grid>
  );
};
