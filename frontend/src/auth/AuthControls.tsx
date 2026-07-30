import { ActionIcon, Button, Menu } from "@mantine/core";
import { IconLogout } from "@tabler/icons-react";
import { useLocation, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useAuth } from "@/auth";

export function AuthControls() {
  const { isModerator, username, logout } = useAuth();
  const { t } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();
  if (isModerator) {
    return (
      <Menu shadow="md" width={150}>
        <Menu.Target>
          <ActionIcon
            radius="xl"
            size="lg"
            variant="filled"
            aria-label={username}
          >
            {username[0].toUpperCase()}
          </ActionIcon>
        </Menu.Target>
        <Menu.Dropdown>
          <Menu.Item
            leftSection={<IconLogout size={16} />}
            color="red"
            onClick={logout}
          >
            {t("auth.logout")}
          </Menu.Item>
        </Menu.Dropdown>
      </Menu>
    );
  }
  return (
    <Button
      onClick={() => navigate("/login", { state: { from: location.pathname } })}
    >
      {t("auth.login")}
    </Button>
  );
}
