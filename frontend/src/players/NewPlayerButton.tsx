import { CreateButton } from "@/table/CreateButton";
import { AnyMutation } from "@/table/types";
import { components } from "@/client/schema";
import { usePlayerCreateConfig } from "./playerCreateConfig";
import { usePlayers } from "./usePlayers";

type PlayerPublic = components["schemas"]["PlayerPublic"];

/**
 * The shared create-player dialog, reporting the player it created.
 *
 * `CreateButton` already owns the form, the validation and the error handling;
 * this only wraps the create mutation, because a caller outside a table needs
 * the new player's id (the registration screen drops it straight into the add
 * box).
 */
export default function NewPlayerButton({
  onCreated,
}: {
  onCreated: (player: PlayerPublic) => void;
}) {
  const createConfig = usePlayerCreateConfig();
  const { createMutation } = usePlayers();

  const mutation: AnyMutation = {
    ...createMutation,
    mutate: (variables, options) =>
      createMutation.mutate(variables, {
        ...options,
        onSuccess: (data, ...rest) => {
          onCreated(data);
          options?.onSuccess?.(data, ...rest);
        },
      }),
  };

  return (
    <CreateButton
      entityType="player"
      mutation={mutation}
      dialogConfig={createConfig}
    />
  );
}
