import { ActionIcon, Button, Menu } from "@mantine/core";
import { IconLogout } from "@tabler/icons-react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/auth";

export function AuthControls() {
  const { isModerator, username, logout } = useAuth();
  const navigate = useNavigate();
  if (isModerator) {
    return (
      <Menu shadow="md" width={150}>
        <Menu.Target>
          <ActionIcon radius="xl" size="lg" aria-label={username}>
            {username[0].toUpperCase()}
          </ActionIcon>
        </Menu.Target>
        <Menu.Dropdown>
          <Menu.Item
            leftSection={<IconLogout size={16} />}
            color="red"
            onClick={logout}
          >
            Log out
          </Menu.Item>
        </Menu.Dropdown>
      </Menu>
    );
  }
  return (
    <Button variant="filled" onClick={() => navigate("/login")}>
      Login
    </Button>
  );
}
