import { Table } from "@mantine/core";
import { IconCheck } from "@tabler/icons-react";
import { useTranslation } from "react-i18next";
import { formatHTTPValidationError } from "@client/api";
import { LoadingState } from "@/ui/LoadingState";
import { ErrorState } from "@/ui/ErrorState";
import { useRegistrations } from "./useRegistrations";

export default function RegisteredPlayerTable({
  competitionName,
  roundNr,
}: {
  competitionName: string;
  roundNr: number;
}) {
  const { t } = useTranslation();
  const { registrations, error, isPending, isError } = useRegistrations(
    competitionName,
    roundNr,
  );

  if (isPending) return <LoadingState />;
  if (isError || !registrations)
    return <ErrorState message={formatHTTPValidationError(error)} />;

  const hasBye = registrations.some((rp) => rp.is_bye);

  return (
    <Table>
      <Table.Thead>
        <Table.Tr>
          <Table.Th>{t("registration.player")}</Table.Th>
          <Table.Th>{t("rating.ratingHeader")}</Table.Th>
          {hasBye && <Table.Th>{t("registration.bye")}</Table.Th>}
        </Table.Tr>
      </Table.Thead>
      <Table.Tbody>
        {registrations.map((rp) => (
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
