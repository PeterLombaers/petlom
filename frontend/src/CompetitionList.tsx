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
    <div className="container">
      <ul>
        {data.map((competition) => {
          return (
            <li key={competition.name}>
              <Competition {...competition} />
            </li>
          );
        })}
      </ul>
    </div>
  );
};
