import { useCallback, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  DataGrid,
  GridActionsCellItem,
  GridColDef,
  GridEventListener,
  GridRenderEditCellParams,
  GridRowEditStopReasons,
  GridRowId,
  GridRowModel,
  GridRowModes,
  GridRowModesModel,
  Toolbar,
  ToolbarButton,
  useGridApiContext,
} from "@mui/x-data-grid";
import {
  Alert,
  AlertProps,
  Box,
  Snackbar,
  Tooltip,
  Typography,
} from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import SaveIcon from "@mui/icons-material/Save";
import CancelIcon from "@mui/icons-material/Cancel";
import EditIcon from "@mui/icons-material/Edit";
import DeleteIcon from "@mui/icons-material/Delete";

import { $api } from "@client/api";
import CreateMatchDialog from "./CreateMatchDialog";
import { components } from "@client/schema";
import ResultToggle from "@components/ResultToggle";
import PlayerSelect from "@components/PlayerSelect";

type PlayerPublicMinimal = components["schemas"]["PlayerPublicMinimal"];
type MatchListProps = {
  competition_name: string;
  round: number;
  max_board: number;
};

function CustomToolbar({ competition_name, round, max_board }: MatchListProps) {
  const [addMatchOpen, setAddMatchOpen] = useState(false);

  const handleAddMatchClick = () => {
    setAddMatchOpen(true);
  };

  return (
    <Toolbar>
      <Box
        sx={{ display: "flex", justifyContent: "space-between", width: "100%" }}
      >
        <Typography>
          {competition_name} — Round {round}
        </Typography>

        <Box>
          <Tooltip title="Add match">
            <ToolbarButton onClick={handleAddMatchClick}>
              <AddIcon fontSize="small" />
            </ToolbarButton>
          </Tooltip>
        </Box>
      </Box>
      <CreateMatchDialog
        open={addMatchOpen}
        setOpen={setAddMatchOpen}
        competition_name={competition_name}
        round={round}
        default_board={max_board + 1}
      ></CreateMatchDialog>
    </Toolbar>
  );
}

function ResultEditComponent(props: GridRenderEditCellParams) {
  const { id, value, field } = props;
  const apiRef = useGridApiContext();

  const handleValueChange = (newResult: ("1-0" | "1/2-1/2" | "0-1") | null) => {
    apiRef.current.setEditCellValue({ id, field, value: newResult });
  };

  return <ResultToggle result={value} setResult={handleValueChange} />;
}

function PlayerEditComponent(props: GridRenderEditCellParams) {
  const { id, value, field } = props;
  const apiRef = useGridApiContext();

  const handleValueChange = (newPlayer: PlayerPublicMinimal) => {
    apiRef.current.setEditCellValue({ id, field, value: newPlayer });
  };

  return <PlayerSelect player={value} setPlayer={handleValueChange} />;
}

export const MatchList = ({ competition_name, round }: MatchListProps) => {
  const {
    data: matches,
    error,
    isPending,
    isError,
  } = $api.useQuery("get", "/competitions/{name}/round/{round_nr}", {
    params: { path: { name: competition_name, round_nr: round } },
  });

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
  } = $api.useMutation("patch", "/matches/{id}", {
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/matches/"] });
    },
    onError: (error) => {
      console.log(error.detail?.[0]?.msg);
    },
  });

  const { mutateAsync: deleteMutateAsync, error: deleteError } =
    $api.useMutation("delete", "/matches/{id}", {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: ["/matches/"] });
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
      params: { path: { id: id as number } },
    });
    if (!!deleteError) {
      let message = `Failed to delete match ${id}; Error: ${deleteError.detail}`;
      setSnackbar({ children: message, severity: "error" });
    } else {
      setSnackbar({
        children: "Match successfully deleted",
        severity: "success",
      });
    }
  };

  const handleRowModesModelChange = (newRowModesModel: GridRowModesModel) => {
    setRowModesModel(newRowModesModel);
  };

  const processRowUpdate = useCallback(
    async (newRow: GridRowModel) => {
      // Hacky way to make sure that when the player is updated, the separate player id
      // field is updated as well. Of course, better would be not to have both fields
      // on the model in the first place.
      newRow.player_white_id = newRow.player_white?.id ?? null;
      newRow.player_black_id = newRow.player_black?.id ?? null;

      // Make the HTTP request to save in the backend
      await updateMutateAsync({
        params: { path: { id: newRow.id } },
        body: newRow,
      });
      if (!!updateError) {
        const details = updateError.detail;

        let message = "Failed to update match";

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

      const updatedRow = updateData ?? newRow;

      setSnackbar({
        children: "Match successfully saved",
        severity: "success",
      });

      return updatedRow;
    },
    [updateMutateAsync]
  );

  const handleProcessRowUpdateError = useCallback((error: Error) => {
    setSnackbar({ children: error.message, severity: "error" });
  }, []);

  const columns: GridColDef[] = [
    { field: "board", headerName: "", width: 50, editable: true },
    {
      field: "player_white",
      headerName: "White Player",
      width: 200,
      valueFormatter: (value: PlayerPublicMinimal) => {
        return value.name;
      },
      editable: true,
      renderEditCell: (params: GridRenderEditCellParams) => (
        <PlayerEditComponent {...params} />
      ),
    },
    {
      field: "player_black",
      headerName: "Black Player",
      width: 200,
      valueFormatter: (value: PlayerPublicMinimal) => {
        return value.name;
      },
      editable: true,
      renderEditCell: (params: GridRenderEditCellParams) => (
        <PlayerEditComponent {...params} />
      ),
    },
    {
      field: "result",
      headerName: "Result",
      width: 200,
      editable: true,
      renderEditCell: (params: GridRenderEditCellParams) => (
        <ResultEditComponent {...params} />
      ),
    },
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

  if (isPending || !matches) return "Loading...";

  if (isError) {
    console.log(error.detail?.[0]?.msg);
    return `An error occured: ${error.detail?.[0]?.msg}`;
  }

  const maxBoard =
    matches.length > 0 ? Math.max(...matches.map((match) => match.board)) : 0;

  return (
    <>
      <DataGrid
        rows={matches}
        columns={columns}
        rowModesModel={rowModesModel}
        onRowModesModelChange={handleRowModesModelChange}
        onRowEditStop={handleRowEditStop}
        processRowUpdate={processRowUpdate}
        onProcessRowUpdateError={handleProcessRowUpdateError}
        slots={{ toolbar: CustomToolbar }}
        slotProps={{
          toolbar: {
            competition_name,
            round,
            max_board: maxBoard,
          },
        }}
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
