import { useParams } from "react-router-dom";
import NotFoundPage from "./NotFoundPage";
import { useQuery } from "@tanstack/react-query";
import { getCompetition } from "../client/api";

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
  return <div>CompetitionDetailPage {competition.name}</div>;
}
