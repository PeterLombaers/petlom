import { Badge } from "@mantine/core";
import { ReactNode } from "react";
import { useTranslation } from "react-i18next";

export function RatingValue({
  value,
  fallback,
}: {
  value?: number | null;
  /**
   * Shown instead of the "no rating" badge when there is no value. Pass it where a
   * missing value does not mean the rating is unknown, such as a performance rating
   * the player has not played a game for yet.
   */
  fallback?: ReactNode;
}) {
  const { t } = useTranslation();

  if (value == null) {
    if (fallback !== undefined) return <>{fallback}</>;
    return (
      <Badge component="span" size="xs" variant="light" color="yellow">
        {t("rating.unknown")}
      </Badge>
    );
  }

  return <>{Math.round(value)}</>;
}
