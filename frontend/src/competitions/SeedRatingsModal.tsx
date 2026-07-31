import { Button, Group, Modal, NumberInput, Stack, Text } from "@mantine/core";
import { useTranslation } from "react-i18next";
import { useState } from "react";

export type PlayerNeedingRating = { id: number; name: string };

/**
 * Asks for an initial rating per player. Mount it only while ratings are
 * needed, so each round of questions starts with empty inputs.
 */
export default function SeedRatingsModal({
  players,
  onClose,
  onConfirm,
  isPending = false,
}: {
  players: PlayerNeedingRating[];
  onClose: () => void;
  onConfirm: (initialRatings: Record<number, number>) => void;
  isPending?: boolean;
}) {
  const { t } = useTranslation();
  const [ratings, setRatings] = useState<Record<number, number | string>>(() =>
    Object.fromEntries(players.map((p) => [p.id, ""])),
  );

  const isFilled = (value: number | string | undefined) =>
    value !== "" && value != null;
  const allRatingsFilled = players.every((p) => isFilled(ratings[p.id]));

  const handleConfirm = () => {
    if (!allRatingsFilled) return;
    onConfirm(
      Object.fromEntries(players.map((p) => [p.id, Number(ratings[p.id])])),
    );
  };

  return (
    <Modal opened onClose={onClose} title={t("rating.setRatingsTitle")}>
      <Stack>
        <Text size="sm">{t("rating.setRatingsDescription")}</Text>
        {players.map((p) => (
          <NumberInput
            key={p.id}
            label={t("rating.initialRatingLabel", { playerName: p.name })}
            value={ratings[p.id]}
            onChange={(v) => setRatings((prev) => ({ ...prev, [p.id]: v }))}
            min={0}
            allowDecimal={false}
            required
          />
        ))}
        <Group justify="flex-end">
          <Button variant="default" onClick={onClose}>
            {t("common.cancel")}
          </Button>
          <Button
            onClick={handleConfirm}
            disabled={!allRatingsFilled || isPending}
            loading={isPending}
          >
            {t("rating.confirm")}
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
}
