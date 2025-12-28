import { useCallback, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
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

import { $api } from "@client/api";
import CreatePlayerDialog from "./CreatePlayerDialog";

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
  } = $api.useQuery("get", "/players/");

  const [rowModesModel, setRowModesModel] = useState<GridRowModesModel>({});
  const [snackbar, setSnackbar] = useState<Pick<
    AlertProps,
    "children" | "severity"
  > | null>(null);

  const queryClient = useQueryClient();
  const {
    mutateAsync: updateMutateAsync,
    data: updateData,
    error: updateError,
  } = $api.useMutation("patch", "/players/{player_id}/", {
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/players/"] });
    },
    onError: (error) => {
      console.log(error.detail?.[0]?.msg);
    },
  });

  const { mutateAsync: deleteMutateAsync, error: deleteError } =
    $api.useMutation("delete", "/players/{player_id}/", {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: ["/players/"] });
      },
      onError: (error) => {
        console.log(error.detail?.[0]?.msg);
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
    await deleteMutateAsync({
      params: { path: { player_id: id as number } },
    });
    if (!!deleteError) {
      let message = `Failed to delete player ${id}; Error: ${deleteError.detail}`;
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
      await updateMutateAsync({
        params: { path: { player_id: newRow.id } },
        body: newRow,
      });
      if (!!updateError) {
        const details = updateError.detail;

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
      const updatedRow = updateData ?? newRow;
      return updatedRow;
    },
    [updateMutateAsync]
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
    console.log(error.detail?.[0]?.msg);
    return `An error occured: ${error.detail?.[0]?.msg}`;
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
