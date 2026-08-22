import { Button, Group, Modal, Radio, Stack, Text } from "@mantine/core";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { formatHTTPValidationError } from "@client/api";
import { components } from "@client/schema";
import { ErrorState } from "@/ui/ErrorState";
import PlayerSelect from "./PlayerSelect";
import { usePlayers } from "./usePlayers";

type PlayerRef = components["schemas"]["PlayerRef"];

const NO_PLAYER: PlayerRef = { id: 0, name: "", is_active: true };

/**
 * Folds a duplicate of this player into them.
 *
 * Mount it only while it is open, so a new merge starts from a clean form. The
 * backend refuses a merge whose data would collide — the same round, the same
 * rating, two different ids at the same source — and writes nothing when it
 * does, so the error shown here doubles as a preview: fix what it names and try
 * again.
 *
 * `player` is only ever read for its id and name, so a table row identifies the
 * surviving player just as well as a full PlayerRef does.
 */
export default function MergePlayerModal({
  player,
  onClose,
}: {
  player: { id: number; name: string };
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const { mergeMutation } = usePlayers();
  const [other, setOther] = useState<PlayerRef>(NO_PLAYER);
  // Which of the two names the merged player keeps. The row we started from
  // always survives, so this only decides the name, not who absorbs whom.
  const [keepName, setKeepName] = useState<string>(String(player.id));

  const hasOther = other.id !== 0;

  const handleMerge = () => {
    mergeMutation.mutate(
      {
        params: { path: { id: player.id } },
        body: {
          other_id: other.id,
          name: keepName === String(player.id) ? player.name : other.name,
        },
      },
      { onSuccess: onClose },
    );
  };

  return (
    <Modal opened onClose={onClose} title={t("player.merge")}>
      <Stack>
        <Text size="sm">
          {t("player.mergeDescription", { name: player.name })}
        </Text>
        <PlayerSelect
          player={other}
          setPlayer={setOther}
          label={t("player.mergeSelectLabel")}
          filterOptions={(options) => options.filter((p) => p.id !== player.id)}
        />
        {hasOther && (
          <Radio.Group
            value={keepName}
            onChange={setKeepName}
            label={t("player.mergeKeepNameLabel")}
          >
            <Stack gap="xs" mt="xs">
              <Radio value={String(player.id)} label={player.name} />
              <Radio value={String(other.id)} label={other.name} />
            </Stack>
          </Radio.Group>
        )}
        {mergeMutation.isError && (
          <ErrorState
            message={formatHTTPValidationError(mergeMutation.error)}
          />
        )}
        <Group justify="flex-end">
          <Button variant="default" onClick={onClose}>
            {t("common.cancel")}
          </Button>
          <Button
            onClick={handleMerge}
            disabled={!hasOther}
            loading={mergeMutation.isPending}
          >
            {t("player.mergeConfirm")}
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
}
