import * as React from "react";
import ToggleButton from "@mui/material/ToggleButton";
import ToggleButtonGroup from "@mui/material/ToggleButtonGroup";
import { components } from "./client/schema";
import { Typography } from "@mui/material";

type Result = components["schemas"]["Result"];
type ResultToggleProps = {
  result: Result | null;
  setResult: (value: Result | null) => void;
};

export default function ResultToggle({ result, setResult }: ResultToggleProps) {
  const handleChange = (
    _event: React.MouseEvent<HTMLElement>,
    newResult: Result | "null"
  ) => {
    setResult(newResult === "null" ? null : newResult);
  };

  return (
    <ToggleButtonGroup
      value={result === null ? "null" : result}
      exclusive
      onChange={handleChange}
      aria-label="Match Result"
      sx={{ display: "flex" }}
    >
      <ToggleButton
        value="1-0"
        aria-label="White Win"
        sx={{ flex: 1, whiteSpace: "nowrap" }}
      >
        <Typography>1-0</Typography>
      </ToggleButton>
      <ToggleButton
        value="1/2-1/2"
        aria-label="Draw"
        sx={{ flex: 1, whiteSpace: "nowrap" }}
      >
        <Typography>½-½</Typography>
      </ToggleButton>
      <ToggleButton
        value="0-1"
        aria-label="Black Win"
        sx={{ flex: 1, whiteSpace: "nowrap" }}
      >
        <Typography>0-1</Typography>
      </ToggleButton>
      <ToggleButton
        value="null"
        aria-label="No Result"
        sx={{ flex: 1, whiteSpace: "nowrap" }}
      >
        <Typography>---</Typography>
      </ToggleButton>
    </ToggleButtonGroup>
  );
}
