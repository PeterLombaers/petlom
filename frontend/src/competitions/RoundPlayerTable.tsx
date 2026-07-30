import { Table, Text } from "@mantine/core";
import { IconCheck } from "@tabler/icons-react";
import { useTranslation } from "react-i18next";
import { useRoundPlayers } from "./useRoundPlayers";

export default function RoundPlayerTable({
  competitionName,
  roundNr,
}: {
  competitionName: string;
  roundNr: number;
}) {
  const { t } = useTranslation();
  const { roundPlayers, isPending, isError } = useRoundPlayers(
    competitionName,
    roundNr,
  );

  if (isPending) return <Text>{t("roundPlayers.loadingList")}</Text>;
  if (isError || !roundPlayers)
    return <Text>{t("roundPlayers.errorLoading")}</Text>;

  const hasBye = roundPlayers.some((rp) => rp.is_bye);

  return (
    <Table>
      <Table.Thead>
        <Table.Tr>
          <Table.Th>{t("roundPlayers.player")}</Table.Th>
          <Table.Th>{t("rating.ratingHeader")}</Table.Th>
          {hasBye && <Table.Th>{t("roundPlayers.bye")}</Table.Th>}
        </Table.Tr>
      </Table.Thead>
      <Table.Tbody>
        {roundPlayers.map((rp) => (
          <Table.Tr key={rp.id}>
            <Table.Td>{rp.player.name}</Table.Td>
            <Table.Td>
              {rp.initial_rating != null ? Math.round(rp.initial_rating) : "—"}
            </Table.Td>
            {hasBye && (
              <Table.Td>{rp.is_bye && <IconCheck size={16} />}</Table.Td>
            )}
          </Table.Tr>
        ))}
      </Table.Tbody>
    </Table>
  );
}
