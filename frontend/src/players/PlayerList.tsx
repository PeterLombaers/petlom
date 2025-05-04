import { useCallback, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  DataGrid,
  GridActionsCellItem,
  GridColDef,
  GridEventListener,
  GridRowEditStopReasons,
  GridRowId,
  GridRowModel,
  GridRowModes,
  GridRowModesModel,
  Toolbar,
  ToolbarButton,
} from "@mui/x-data-grid";
import { Alert, AlertProps, Snackbar, Tooltip } from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import SaveIcon from "@mui/icons-material/Save";
import CancelIcon from "@mui/icons-material/Cancel";
import EditIcon from "@mui/icons-material/Edit";
import DeleteIcon from "@mui/icons-material/Delete";

import { apiClient, getPlayerList } from "../client/api";
import CreatePlayerDialog from "./CreatePlayerDialog";
import { components } from "../client/schema";

type PlayerUpdate = components["schemas"]["PlayerUpdate"];
type PlayerUpdateInput = { id: number } & PlayerUpdate;

function CustomToolbar() {
  const [addPlayerOpen, setAddPlayerOpen] = useState(false);

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
    queryFn: () => getPlayerList(true),
  });

  const [rowModesModel, setRowModesModel] = useState<GridRowModesModel>({});
  const [snackbar, setSnackbar] = useState<Pick<
    AlertProps,
    "children" | "severity"
  > | null>(null);

  const queryClient = useQueryClient();
  const updateMutation = useMutation({
    mutationFn: ({ id, ...rest }: PlayerUpdateInput) =>
      apiClient.PATCH("/players/{player_id}/", {
        params: { path: { player_id: id } },
        body: rest,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/players/"] });
    },
    onError: (error) => {
      console.log(error.message);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) =>
      apiClient.DELETE("/players/{player_id}/", {
        params: { path: { player_id: id } },
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/players/"] });
    },
    onError: (error) => {
      console.log(error.message);
    },
  });

  const handleCloseSnackbar = () => setSnackbar(null);
  const handleRowEditStop: GridEventListener<"rowEditStop"> = (
    params,
    event
  ) => {
    if (params.reason === GridRowEditStopReasons.rowFocusOut) {
      event.defaultMuiPrevented = true;
    }
  };

  const handleSaveClick = (id: GridRowId) => () =>
    setRowModesModel({ ...rowModesModel, [id]: { mode: GridRowModes.View } });
  const handleCancelClick = (id: GridRowId) => () => {
    setRowModesModel({
      ...rowModesModel,
      [id]: { mode: GridRowModes.View, ignoreModifications: true },
    });
  };
  const handleEditClick = (id: GridRowId) => () =>
    setRowModesModel({ ...rowModesModel, [id]: { mode: GridRowModes.Edit } });
  const handleDeleteClick = (id: GridRowId) => async () => {
    const response = await deleteMutation.mutateAsync(id as number);
    if (!!response.error) {
      let message = `Failed to delete player ${id}; Error: ${response.error.detail}`;
      setSnackbar({ children: message, severity: "error" });
    } else {
      setSnackbar({
        children: "Player successfully deleted",
        severity: "success",
      });
    }
  };

  const handleRowModesModelChange = (newRowModesModel: GridRowModesModel) => {
    setRowModesModel(newRowModesModel);
  };

  const processRowUpdate = useCallback(
    async (newRow: GridRowModel) => {
      // Make the HTTP request to save in the backend
      const response = await updateMutation.mutateAsync({
        id: newRow.id,
        ...newRow,
      });
      if (!!response?.error) {
        const details = response.error.detail;

        let message = "Failed to update player";

        if (Array.isArray(details)) {
          const messages = details
            .map((err: any) => {
              const field = Array.isArray(err.loc)
                ? err.loc[err.loc.length - 1]
                : "field";
              return `${field}: ${err.msg}`;
            })
            .join("; ");
          message += `; Errors: ${messages}`;
        } else if (typeof details === "string") {
          message += `: ${details}`;
        }
        throw new Error(message);
      }
      setSnackbar({
        children: "Player successfully saved",
        severity: "success",
      });
      const updatedRow = response?.data ?? newRow;
      return updatedRow;
    },
    [updateMutation.mutateAsync]
  );

  const handleProcessRowUpdateError = useCallback((error: Error) => {
    setSnackbar({ children: error.message, severity: "error" });
  }, []);

  const columns: GridColDef[] = [
    { field: "id", headerName: "", width: 50 },
    { field: "name", headerName: "Name", width: 200, editable: true },
    {
      field: "actions",
      type: "actions",
      headerName: "Actions",
      width: 100,
      cellClassName: "actions",
      getActions: ({ id }) => {
        const isInEditMode = rowModesModel[id]?.mode === GridRowModes.Edit;

        if (isInEditMode) {
          return [
            <GridActionsCellItem
              icon={<SaveIcon />}
              label="Save"
              onClick={handleSaveClick(id)}
            />,
            <GridActionsCellItem
              icon={<CancelIcon />}
              label="Cancel"
              onClick={handleCancelClick(id)}
            />,
          ];
        }

        return [
          <GridActionsCellItem
            icon={<EditIcon />}
            label="Edit"
            onClick={handleEditClick(id)}
          />,
          <GridActionsCellItem
            icon={<DeleteIcon />}
            label="Delete"
            onClick={handleDeleteClick(id)}
          />,
        ];
      },
    },
  ];

  if (isPending || !players) return "Loading...";

  if (isError) {
    console.log(error.message);
    return `An error occured: ${error.message}`;
  }

  return (
    <>
      <DataGrid
        rows={players}
        columns={columns}
        rowModesModel={rowModesModel}
        onRowModesModelChange={handleRowModesModelChange}
        onRowEditStop={handleRowEditStop}
        processRowUpdate={processRowUpdate}
        onProcessRowUpdateError={handleProcessRowUpdateError}
        slots={{ toolbar: CustomToolbar }}
        showToolbar
      />
      {!!snackbar && (
        <Snackbar
          open
          anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
          onClose={handleCloseSnackbar}
          autoHideDuration={10000}
        >
          <Alert {...snackbar} onClose={handleCloseSnackbar} />
        </Snackbar>
      )}
    </>
  );
};
