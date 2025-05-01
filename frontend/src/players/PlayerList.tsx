import { DataGrid, GridColDef } from "@mui/x-data-grid";
import { getPlayerList } from "../client/api";
import { useQuery } from "@tanstack/react-query";

const columns: GridColDef[] = [
  { field: "id", headerName: "", width: 50 },
  { field: "name", headerName: "Name", width: 200 },
];

export const PlayerList = () => {
  const {
    data: players,
    error,
    isPending,
    isError,
  } = useQuery({
    queryKey: ["/players/", "GET"],
    queryFn: getPlayerList,
  });

  if (isPending || !players) return "Loading...";

  if (isError) {
    console.log(error.message);
    return `An error occured: ${error.message}`;
  }

  return <DataGrid rows={players} columns={columns} />;
};
