import { useParams } from "react-router-dom";
import { apiClient } from "../utils";
import { components } from "../client/schema";
import NotFoundPage from "./NotFoundPage";
import { useQuery } from "@tanstack/react-query";

type CompetitionPublic = components["schemas"]["CompetitionPublic"];

export default function CompetitionDetailPage() {
  const { name } = useParams();
  if (!name) {
    return <NotFoundPage />;
  }

  const getCompetition = async (): Promise<CompetitionPublic> => {
    const { data, error } = await apiClient.GET("/competitions/{name}", {
      params: { path: { name: name } },
    });
    if (error) {
      throw new Error(`Error in fetching competitions: ${error.detail}`);
    }
    return data;
  };

  const {
    data: competition,
    error,
    isPending,
  } = useQuery({
    queryKey: ["/competitions/", "GET", name],
    queryFn: getCompetition,
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
