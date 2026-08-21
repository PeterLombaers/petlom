import { Badge, Text } from "@mantine/core";
import { useTranslation } from "react-i18next";

type PlayerNameProps = {
  name: string;
  /** False for a soft-deleted player, which is then marked as such. */
  isActive: boolean;
};

/**
 * A player's name wherever it is shown outside the player list.
 *
 * Deleted players are only soft-deleted, so they keep showing up in matches,
 * registrations and rankings. There they have to be recognisable as deleted.
 */
export function PlayerName({ name, isActive }: PlayerNameProps) {
  const { t } = useTranslation();

  if (isActive) return <>{name}</>;

  return (
    <Text span inherit c="dimmed">
      {name}{" "}
      <Badge component="span" size="xs" variant="light" color="gray">
        {t("player.deleted")}
      </Badge>
    </Text>
  );
}
