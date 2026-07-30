import { AppShell, Burger, Group, NavLink } from "@mantine/core";
import { useDisclosure } from "@mantine/hooks";
import { Link, Outlet, useLocation } from "react-router-dom";
import { IconUsers } from "@tabler/icons-react";
import { AuthControls } from "@/auth/AuthControls";
import { LanguageSwitcher } from "./LanguageSwitcher";
import { PetlomLogo } from "./PetlomLogo";
import { ThemeToggle } from "./ThemeToggle";
import { CompetitionNavLinks } from "./CompetitionNavLinks";
import { useTranslation } from "react-i18next";

export default function Layout() {
  const [navOpen, { toggle: toggleNavOpen, close: closeNav }] = useDisclosure();
  const { pathname } = useLocation();
  const { t } = useTranslation();

  return (
    <AppShell
      header={{ height: 60 }}
      navbar={{ width: 240, breakpoint: "sm", collapsed: { mobile: !navOpen } }}
      padding="md"
    >
      <a href="#main-content" className="skip-link">
        {t("common.skipToContent")}
      </a>
      <AppShell.Header>
        <Group
          h="100%"
          px="md"
          justify="space-between"
          wrap="nowrap"
          style={{ overflow: "hidden" }}
        >
          <Group wrap="nowrap">
            <Burger
              opened={navOpen}
              onClick={toggleNavOpen}
              hiddenFrom="sm"
              size="sm"
            />
            <PetlomLogo size={50} />
          </Group>
          <Group wrap="nowrap">
            <LanguageSwitcher />
            <ThemeToggle />
            <AuthControls />
          </Group>
        </Group>
      </AppShell.Header>
      <AppShell.Navbar p="xs" onClick={closeNav}>
        <CompetitionNavLinks />
        <NavLink
          label={t("nav.players")}
          leftSection={<IconUsers size={16} />}
          component={Link}
          to="/players"
          active={pathname === "/players"}
        />
      </AppShell.Navbar>
      <AppShell.Main id="main-content" tabIndex={-1}>
        <Outlet />
      </AppShell.Main>
    </AppShell>
  );
}
