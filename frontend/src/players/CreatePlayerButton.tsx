import { Button } from "@mui/material";
import { useState } from "react";
import CreatePlayerDialog from "./CreatePlayerDialog";

export default function CreatePlayerButton() {
  const [open, setOpen] = useState(false);

  const handleClose = () => {
    setOpen(false);
  };

  const handleClick = () => {
    setOpen(true);
  };

  return (
    <>
      <Button onClick={handleClick}>New Player</Button>
      <CreatePlayerDialog
        open={open}
        setOpen={setOpen}
        onClose={handleClose}
      ></CreatePlayerDialog>
    </>
  );
}
