import { Button } from "@mui/material";
import { useState } from "react";
import CreateDialog from "./CreateDialog";

export default function DeleteButton() {
  const [open, setOpen] = useState(false);

  const handleClose = () => {
    setOpen(false);
  };

  const handleClick = () => {
    setOpen(true);
  };

  return (
    <>
      <Button onClick={handleClick}>New</Button>
      <CreateDialog
        open={open}
        setOpen={setOpen}
        onClose={handleClose}
      ></CreateDialog>
    </>
  );
}
