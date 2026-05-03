import {
  ActionIcon,
  AppShell,
  Box,
  Burger,
  Group,
  NavLink,
  useMantineColorScheme,
} from "@mantine/core";
import { useDisclosure } from "@mantine/hooks";
import { Link, Outlet, useLocation } from "react-router-dom";
import { IconMoon, IconSun, IconTrophy, IconUsers } from "@tabler/icons-react";
import { useCompetitions } from "@/competitions/useCompetitions";
import { AuthControls } from "@/components/AuthControls";
import { PetlomLogo } from "@/components/PetlomLogo";

function ThemeToggle() {
  const { colorScheme, toggleColorScheme } = useMantineColorScheme();
  return (
    <ActionIcon
      onClick={toggleColorScheme}
      variant="subtle"
      size="lg"
      aria-label="Toggle color scheme"
    >
      {colorScheme === "dark" ? <IconSun size={18} /> : <IconMoon size={18} />}
    </ActionIcon>
  );
}

function CompetitionNavLinks() {
  const { rows: competitions } = useCompetitions();
  const { pathname } = useLocation();
  const { colorScheme } = useMantineColorScheme();
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
        label="Competitions"
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
                ? `2px solid var(--mantine-color-red-${borderColor})`
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

export default function Layout() {
  const [navOpen, { toggle: toggleNavOpen }] = useDisclosure();
  const { pathname } = useLocation();

  return (
    <AppShell
      header={{ height: 60 }}
      navbar={{ width: 240, breakpoint: "sm", collapsed: { mobile: !navOpen } }}
      padding="md"
    >
      <AppShell.Header>
        <Group h="100%" px="md" justify="space-between">
          <Group>
            <Burger
              opened={navOpen}
              onClick={toggleNavOpen}
              hiddenFrom="sm"
              size="sm"
            />
            <PetlomLogo size={50} />
          </Group>
          <Group>
            <ThemeToggle />
            <AuthControls />
          </Group>
        </Group>
      </AppShell.Header>
      <AppShell.Navbar p="xs">
        <CompetitionNavLinks />
        <NavLink
          label="Players"
          leftSection={<IconUsers size={16} />}
          component={Link}
          to="/players"
          active={pathname === "/players"}
        />
      </AppShell.Navbar>
      <AppShell.Main>
        <Outlet />
      </AppShell.Main>
    </AppShell>
  );
}
