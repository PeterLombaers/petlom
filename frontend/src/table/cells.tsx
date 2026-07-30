import { Anchor, NumberInput, TextInput } from "@mantine/core";

const formatDate = (dateString: string) => {
  return new Date(dateString).toLocaleDateString();
};

export const createTextCell = (fieldName: string, label: string) => ({
  renderValue: (props: { value: string }) => props.value,
  renderEdit: (props: {
    editValue: string;
    error: string;
    onChange: (newValue: string) => void;
  }) => (
    <TextInput
      name={fieldName}
      label={label}
      value={props.editValue}
      error={props.error || undefined}
      onChange={(e) => props.onChange(e.target.value)}
    />
  ),
});

export const createReadOnlyTextCell = () => ({
  renderValue: (props: { value: string }) => props.value,
});

export const createReadOnlyDateCell = () => ({
  renderValue: (props: { value: string }) => formatDate(props.value),
});

export const createNumberCell = (fieldName: string) => ({
  renderValue: (props: { value: number }) => props.value.toString(),
  renderEdit: (props: {
    editValue: number;
    error: string;
    onChange: (newValue: number) => void;
  }) => (
    <NumberInput
      name={fieldName}
      value={props.editValue}
      error={props.error || undefined}
      onChange={(val) => props.onChange(Number(val))}
    />
  ),
});

export const createReadOnlyNumberCell = () => ({
  renderValue: (props: { value: number }) => props.value.toString(),
});

export const createLinkTextCell = (
  fieldName: string,
  label: string,
  getHref: (value: string) => string,
) => ({
  renderValue: (props: { value: string }) => (
    <Anchor href={getHref(props.value)}>{props.value}</Anchor>
  ),
  renderEdit: (props: {
    editValue: string;
    error: string;
    onChange: (newValue: string) => void;
  }) => (
    <TextInput
      name={fieldName}
      label={label}
      value={props.editValue}
      error={props.error || undefined}
      onChange={(e) => props.onChange(e.target.value)}
    />
  ),
});

export const createNonEmptyStringValidator =
  (field: string, message = "Value should not be empty") =>
  (value: string, errors: Record<string, string>) => {
    if (!value) {
      errors[field] = message;
    }
  };
