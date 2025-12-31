import {
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
} from "@mui/material";
import { useState } from "react";
import AddIcon from "@mui/icons-material/Add";
import AddCircleIcon from "@mui/icons-material/AddCircle";
import CheckIcon from "@mui/icons-material/Check";
import { UseMutationResult } from "@tanstack/react-query";
import { formatHTTPValidationError } from "@/client/api";

export interface CreateDialogConfig<T = any> {
  getInitialFormData: () => T;
  validateForm: (formData: T) => Record<string, string>;
  sanitizeForm: (formData: T) => T;
  getRequestBody: (formData: T) => any;
  renderContent: (props: {
    formData: T;
    errors: Record<string, string>;
    onChange: (field: string, value: any) => void;
  }) => React.ReactNode;
}

interface CreateButtonProps<T = any> {
  entityType: string;
  mutation: UseMutationResult<any, any, any, any>;
  dialogConfig: CreateDialogConfig<T>;
}

export function CreateButton<T = any>({
  entityType,
  mutation,
  dialogConfig: {
    getInitialFormData,
    validateForm,
    sanitizeForm,
    getRequestBody,
    renderContent,
  },
}: CreateButtonProps<T>) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [formData, setFormData] = useState<T>(getInitialFormData());
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});

  const handleDialogClose = () => {
    setDialogOpen(false);
  };

  const handleDialogOpen = () => {
    setDialogOpen(true);
  };

  const onFormDataChange = (field: string, value: any) => {
    setFormData({ ...formData, [field]: value });
    if (formErrors[field]) {
      const { [field]: _, ...rest } = formErrors;
      setFormErrors(rest);
    }
  };

  const resetForm = () => {
    setFormErrors({});
    setFormData(getInitialFormData());
  };

  const handleSubmit = (next: boolean) => {
    const sanitizedFormData = sanitizeForm(formData);
    const errors = validateForm(sanitizedFormData);
    if (Object.keys(errors).length > 0) {
      setFormErrors(errors);
      return;
    }
    mutation.mutate(
      { body: getRequestBody(sanitizedFormData) },
      {
        onSuccess: () => {
          if (!next) {
            handleDialogClose();
          }
          resetForm();
        },
        onError: (error) => {
          const errorMessage = formatHTTPValidationError(error);
          console.error(errorMessage);
        },
      }
    );
  };

  return (
    <>
      <IconButton
        onClick={handleDialogOpen}
        disabled={mutation.isPending}
        aria-label={`Add ${entityType}`}
      >
        <AddIcon />
      </IconButton>
      <Dialog open={dialogOpen} onClose={handleDialogClose}>
        <DialogTitle>Add new {entityType}</DialogTitle>
        <DialogContent dividers>
          {renderContent({
            formData,
            errors: formErrors,
            onChange: onFormDataChange,
          })}
        </DialogContent>
        <DialogActions>
          <IconButton
            onClick={() => handleSubmit(false)}
            disabled={mutation.isPending}
            aria-label="Save and close"
            title="Save and close"
          >
            <CheckIcon />
          </IconButton>
          <IconButton
            onClick={() => handleSubmit(true)}
            disabled={mutation.isPending}
            aria-label="Save and add another"
            title="Save and add another"
          >
            <AddCircleIcon />
          </IconButton>
        </DialogActions>
      </Dialog>
    </>
  );
}
