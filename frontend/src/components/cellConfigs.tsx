import { TextField } from "@mui/material";

export const formatDate = (dateString: string) => {
  return new Date(dateString).toLocaleDateString();
};

export const createTextCell = (fieldName: string, label: string) => ({
  renderValue: (props: { value: string }) => props.value,
  renderEdit: (props: {
    editValue: string;
    error: string;
    onChange: (newValue: string) => void;
  }) => (
    <TextField
      name={fieldName}
      label={label}
      value={props.editValue}
      error={!!props.error}
      helperText={props.error}
      onChange={(e) => props.onChange(e.target.value)}
      fullWidth
    />
  ),
});

export const createReadOnlyTextCell = () => ({
  renderValue: (props: { value: string }) => props.value,
});

export const createReadOnlyDateCell = () => ({
  renderValue: (props: { value: string }) => formatDate(props.value),
});

export const createNumberCell = (fieldName: string, label: string) => ({
  renderValue: (props: { value: number }) => props.value.toString(),
  renderEdit: (props: {
    editValue: number;
    error: string;
    onChange: (newValue: number) => void;
  }) => (
    <TextField
      name={fieldName}
      label={label}
      type="number"
      value={props.editValue}
      error={!!props.error}
      helperText={props.error}
      onChange={(e) => props.onChange(Number(e.target.value))}
      fullWidth
    />
  ),
});

export const createReadOnlyNumberCell = () => ({
  renderValue: (props: { value: number }) => props.value.toString(),
});

export const createNonEmptyStringValidator =
  (field: string) => (value: string, errors: Record<string, string>) => {
    if (!value) {
      errors[field] = "Value should not be empty";
    }
  };
