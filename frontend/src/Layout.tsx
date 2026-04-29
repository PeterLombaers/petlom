import { AppShell, Badge, Button, NavLink, Text } from "@mantine/core";
import { Outlet, useNavigate } from "react-router-dom";
import { Link } from "react-router-dom";
import { IconTrophy, IconUsers } from "@tabler/icons-react";
import { useCompetitions } from "@/competitions/useCompetitions";
import { useAuth } from "@/auth";

function RecentCompetitions() {
  const { competitions } = useCompetitions();
  if (!competitions || competitions.length === 0) return null;

  const recent = [...competitions]
    .sort((a, b) => b.updated_at.localeCompare(a.updated_at))
    .slice(0, 3);

  return (
    <>
      {recent.map((c) => (
        <NavLink
          key={c.name}
          label={c.name}
          component={Link}
          to={`/competitions/${c.name}`}
        />
      ))}
    </>
  );
}

function AuthControls() {
  const { isModerator, username, logout } = useAuth();
  const navigate = useNavigate();

  if (isModerator) {
    return (
      <>
        <Badge>{username}</Badge>
        <Button onClick={logout}>Logout</Button>
      </>
    );
  }
  return <Button onClick={() => navigate("/login")}>Login</Button>;
}

export default function Layout() {
  return (
    <AppShell header={{ height: 60 }} navbar={{ width: 240, breakpoint: "sm" }}>
      <AppShell.Header>
        <Text>PetLom</Text>
        <AuthControls />
      </AppShell.Header>
      <AppShell.Navbar>
        <NavLink
          label="Competitions"
          leftSection={<IconTrophy size={16} />}
          component={Link}
          to="/competitions"
        />
        <RecentCompetitions />
        <NavLink
          label="Players"
          leftSection={<IconUsers size={16} />}
          component={Link}
          to="/players"
        />
      </AppShell.Navbar>
      <AppShell.Main>
        <Outlet />
      </AppShell.Main>
    </AppShell>
  );
}
