import { Box, NavLink, useMantineColorScheme } from "@mantine/core";
import { IconTrophy } from "@tabler/icons-react";
import { Link, useLocation } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useCompetitions } from "@/competitions/useCompetitions";

export function CompetitionNavLinks() {
  const { rows: competitions } = useCompetitions();
  const { pathname } = useLocation();
  const { colorScheme } = useMantineColorScheme();
  const { t } = useTranslation();
  const borderColor =
    colorScheme === "dark"
      ? "var(--mantine-color-red-9)"
      : "var(--mantine-color-red-2)";

  const recent = competitions
    ? [...competitions]
        .sort((a, b) => b.updated_at.localeCompare(a.updated_at))
        .slice(0, 3)
    : [];

  return (
    <>
      <NavLink
        label={t("nav.competitions")}
        leftSection={<IconTrophy size={16} />}
        component={Link}
        to="/competitions"
        active={pathname === "/competitions"}
      />
      {recent.length > 0 && (
        <Box
          ml="sm"
          style={{
            borderLeft:
              pathname === "/competitions"
                ? `2px solid ${borderColor}`
                : undefined,
          }}
        >
          {recent.map((c) => (
            <NavLink
              key={c.name}
              label={c.name}
              fz="sm"
              component={Link}
              to={`/competitions/${c.name}`}
              pl="md"
              active={pathname.startsWith(`/competitions/${c.name}`)}
            />
          ))}
        </Box>
      )}
    </>
  );
}
