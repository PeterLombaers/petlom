import { Link, TextField } from "@mui/material";
import { components } from "@client/schema";
import PlayerSelect from "@components/PlayerSelect";
import ResultToggle from "@components/ResultToggle";

type PlayerPublicMinimal = components["schemas"]["PlayerPublicMinimal"];
type Result = components["schemas"]["Result"];

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

export const createPlayerSelectCell = (label: string) => ({
  renderValue: (props: { value: PlayerPublicMinimal }) => props.value.name,
  renderEdit: (props: {
    editValue: PlayerPublicMinimal;
    error: string;
    onChange: (newValue: PlayerPublicMinimal) => void;
  }) => (
    <PlayerSelect
      player={props.editValue}
      setPlayer={props.onChange}
      label={label}
      error={!!props.error}
      helperText={props.error}
    />
  ),
});

export const createResultToggleCell = () => ({
  renderValue: (props: { value: Result | null }) => props.value ?? "—",
  renderEdit: (props: {
    editValue: Result | null;
    error: string;
    onChange: (newValue: Result | null) => void;
  }) => <ResultToggle result={props.editValue} setResult={props.onChange} />,
});

export const createLinkTextCell = (
  fieldName: string,
  label: string,
  getHref: (value: string) => string,
) => ({
  renderValue: (props: { value: string }) => (
    <Link href={getHref(props.value)}>{props.value}</Link>
  ),
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

export const createNonEmptyStringValidator =
  (field: string) => (value: string, errors: Record<string, string>) => {
    if (!value) {
      errors[field] = "Value should not be empty";
    }
  };
