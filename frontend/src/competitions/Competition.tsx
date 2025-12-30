import { Card, Link, Typography } from "@mui/material";
import type { components } from "@client/schema";
import DeleteButton from "@components/DeleteButton";
import { $api } from "@/client/api";
import { useQueryClient } from "@tanstack/react-query";

type CompetitionProps = components["schemas"]["CompetitionPublic"];

export function Competition({
  name,
  type,
  created_at: createdAt,
  updated_at: updatedAt,
}: CompetitionProps) {
  const queryClient = useQueryClient();
  const deleteMutation = $api.useMutation("delete", "/competitions/{name}", {
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["get", "/competitions/"] });
    },
  });
  const parsedCreatedDate = new Date(Date.parse(createdAt));
  const parsedUpdatedDate = new Date(Date.parse(updatedAt));
  return (
    <Card style={{ padding: "1rem" }}>
      <Link href={`/competitions/${name}`} underline="hover">
        {name}
      </Link>
      <Typography variant="subtitle2">Type: {type}</Typography>
      <Typography variant="subtitle2">
        Created: {parsedCreatedDate.toDateString()}
      </Typography>
      <Typography variant="subtitle2">
        Updated: {parsedUpdatedDate.toDateString()}
      </Typography>
      <DeleteButton
        entityType="competition"
        entityName={name}
        entityId={name}
        mutation={deleteMutation}
        queryKeysToInvalidate={["get", "/competitions/"]}
      />
    </Card>
  );
}
