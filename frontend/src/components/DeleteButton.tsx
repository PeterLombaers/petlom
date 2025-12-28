import { Button } from "@mui/material";
import { useState } from "react";
import { DeleteDialog } from "../competition/DeleteDialog";

export default function DeleteButton({ name }: { name: string }) {
  const [open, setOpen] = useState(false);

  const handleClose = () => {
    setOpen(false);
  };

  const handleClick = () => {
    setOpen(true);
  };

  return (
    <>
      <Button onClick={handleClick}>Delete</Button>
      <DeleteDialog
        name={name}
        open={open}
        setOpen={setOpen}
        onClose={handleClose}
      ></DeleteDialog>
    </>
  );
}
