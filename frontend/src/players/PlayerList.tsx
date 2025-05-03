import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { DataGrid, GridColDef, Toolbar, ToolbarButton } from "@mui/x-data-grid";
import { Tooltip } from "@mui/material";
import AddIcon from "@mui/icons-material/Add";

import { getPlayerList } from "../client/api";
import CreatePlayerDialog from "./CreatePlayerDialog";

const columns: GridColDef[] = [
  { field: "id", headerName: "", width: 50 },
  { field: "name", headerName: "Name", width: 200, editable: true },
];

function CustomToolbar() {
  const [addPlayerOpen, setAddPlayerOpen] = useState(false);

  const handleAddPlayerClose = () => {
    setAddPlayerOpen(false);
  };

  const handleAddPlayerClick = () => {
    setAddPlayerOpen(true);
  };

  return (
    <Toolbar>
      <Tooltip title="Add player">
        <ToolbarButton onClick={handleAddPlayerClick}>
          <AddIcon fontSize="small" />
        </ToolbarButton>
      </Tooltip>
      <CreatePlayerDialog
        open={addPlayerOpen}
        setOpen={setAddPlayerOpen}
      ></CreatePlayerDialog>
    </Toolbar>
  );
}

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

  return (
    <DataGrid
      rows={players}
      columns={columns}
      slots={{ toolbar: CustomToolbar }}
      showToolbar
    />
  );
};
