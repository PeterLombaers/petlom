import { Badge } from "@mantine/core";
import { useTranslation } from "react-i18next";

export function RatingValue({ value }: { value?: number | null }) {
  const { t } = useTranslation();

  if (value == null) {
    return (
      <Badge component="span" size="xs" variant="light" color="yellow">
        {t("rating.unknown")}
      </Badge>
    );
  }

  return <>{Math.round(value)}</>;
}
