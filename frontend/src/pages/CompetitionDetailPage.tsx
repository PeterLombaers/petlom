import { useParams } from "react-router-dom";
import NotFoundPage from "./NotFoundPage";
import { useQuery } from "@tanstack/react-query";
import { getCompetition } from "../client/api";
import { Breadcrumbs, Link, Stack, Typography } from "@mui/material";
import { Competition } from "../competition/Competition";

export default function CompetitionDetailPage() {
  const { name } = useParams();
  if (!name) {
    return <NotFoundPage />;
  }

  const {
    data: competition,
    error,
    isPending,
  } = useQuery({
    queryKey: ["/competitions/", "GET", name],
    queryFn: () => getCompetition(name),
  });
  if (isPending) {
    return <div>Loading...</div>;
  }
  if (error || !competition) {
    console.log(error);
    return <NotFoundPage />;
  }
  return (
    <Stack>
      <Breadcrumbs>
        <Link href="/" underline="hover" color="inherit">
          PetLom
        </Link>
        <Link href="/competitions" underline="hover" color="inherit">
          Competitions
        </Link>
        <Typography sx={{ color: "text.primary" }}>
          {competition.name}
        </Typography>
      </Breadcrumbs>
      <Competition {...competition} />
      {competition.n_rounds && (
        <Stack direction="row" spacing={1}>
          <Typography>Round:</Typography>
          <Breadcrumbs maxItems={4}>
            {Array.from({ length: competition.n_rounds - 1 }, (_, i) => (
              <Link
                href={`/competitions/${competition.name}/round/${i + 1}`}
                underline="hover"
                color="inherit"
              >
                {i + 1}
              </Link>
            ))}
          </Breadcrumbs>
        </Stack>
      )}
    </Stack>
  );
}
