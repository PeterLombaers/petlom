import { useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import {
  Alert,
  Button,
  Card,
  Center,
  PasswordInput,
  Stack,
  Text,
  TextInput,
} from "@mantine/core";
import { IconAlertCircle } from "@tabler/icons-react";
import { useTranslation } from "react-i18next";
import { PetlomLogo } from "@/layout/PetlomLogo";
import { useAuth } from "@/auth";
import { useDocumentTitle } from "@/pages/useDocumentTitle";

export default function LoginPage() {
  const { login } = useAuth();
  const { t } = useTranslation();
  const pageTitle = t("pageTitle.login");
  useDocumentTitle(pageTitle);
  const navigate = useNavigate();
  const location = useLocation();
  const from = (location.state as { from?: string })?.from ?? "/competitions";
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.SyntheticEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      await login(username, password);
      navigate(from, { replace: true });
    } catch {
      setError(t("auth.invalidCredentials"));
    } finally {
      setLoading(false);
    }
  };

  return (
    <Center h="100vh">
      <Stack w={360} gap="sm">
        <h1 className="sr-only">{pageTitle}</h1>
        <Stack align="center" gap={4}>
          <PetlomLogo size={80} />
          <Text c="dimmed" size="sm">
            {t("auth.moderatorLogin")}
          </Text>
        </Stack>
        <Card withBorder shadow="sm">
          <Stack component="form" onSubmit={handleSubmit} gap="sm">
            {error && (
              <Alert color="red" icon={<IconAlertCircle size={16} />}>
                {error}
              </Alert>
            )}
            <TextInput
              label={t("auth.username")}
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              autoFocus
              required
            />
            <PasswordInput
              label={t("auth.password")}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
            <Button
              type="submit"
              variant="filled"
              loading={loading}
              fullWidth
              mt="xs"
            >
              {t("auth.login")}
            </Button>
          </Stack>
        </Card>
      </Stack>
    </Center>
  );
}
