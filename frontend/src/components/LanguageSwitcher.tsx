import { SegmentedControl } from "@mantine/core";
import { useTranslation } from "react-i18next";

export function LanguageSwitcher() {
  const { i18n } = useTranslation();
  return (
    <SegmentedControl
      size="xs"
      value={i18n.language}
      onChange={(lng) => i18n.changeLanguage(lng)}
      data={[
        { label: "EN", value: "en" },
        { label: "NL", value: "nl" },
      ]}
    />
  );
}
