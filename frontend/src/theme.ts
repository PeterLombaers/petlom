import { createTheme } from "@mantine/core";

export const theme = createTheme({
  primaryColor: "red",
  defaultRadius: "sm",
  components: {
    Button: { defaultProps: { size: "sm" } },
    ActionIcon: { defaultProps: { variant: "subtle" } },
    TextInput: { defaultProps: { size: "sm" } },
    NumberInput: { defaultProps: { size: "sm" } },
    Select: { defaultProps: { size: "sm" } },
    Table: {
      defaultProps: {
        highlightOnHover: true,
        withTableBorder: true,
      },
      styles: {
        th: {
          color: "var(--mantine-color-dimmed)",
          fontWeight: "600",
        },
      },
    },
  },
});
