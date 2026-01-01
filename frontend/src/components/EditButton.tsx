import { Edit, Save } from "@mui/icons-material";
import { IconButton } from "@mui/material";
import { useState } from "react";

export default function EditButton() {
  const [isEditing, setIsEditing] = useState(false);

  const handleClick = () => {
    setIsEditing(!isEditing);
  };

  return (
    <IconButton onClick={handleClick}>
      {isEditing ? <Save /> : <Edit />}
    </IconButton>
  );
}
