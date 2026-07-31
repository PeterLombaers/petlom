import { NumberInput, TextInput } from "@mantine/core";
import type { EditProps } from "./types";

const formatDate = (dateString: string) => {
  return new Date(dateString).toLocaleDateString();
};

// The column header already names the field, so the input is labelled with
// `aria-label` rather than a visible `label` that would render inside the cell.
const textEditor =
  (fieldName: string, label: string) => (props: EditProps<string>) => (
    <TextInput
      name={fieldName}
      aria-label={label}
      value={props.editValue}
      error={props.error || undefined}
      onChange={(e) => props.onChange(e.target.value)}
    />
  );

export const createTextCell = (fieldName: string, label: string) => ({
  renderValue: (props: { value: string }) => props.value,
  renderEdit: textEditor(fieldName, label),
});

export const createNumberCell = (fieldName: string, label: string) => ({
  renderValue: (props: { value: number }) => props.value.toString(),
  renderEdit: (props: EditProps<number>) => (
    <NumberInput
      name={fieldName}
      aria-label={label}
      value={props.editValue}
      error={props.error || undefined}
      onChange={(val) => props.onChange(Number(val))}
    />
  ),
});

export const readOnlyDateCell = {
  renderValue: (props: { value: string }) => formatDate(props.value),
};

export const readOnlyNumberCell = {
  renderValue: (props: { value: number }) => props.value.toString(),
};

export const createNonEmptyStringValidator =
  (field: string, message: string) =>
  (value: string, errors: Record<string, string>) => {
    if (!value) {
      errors[field] = message;
    }
  };
