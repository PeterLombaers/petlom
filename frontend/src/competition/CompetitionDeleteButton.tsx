import { Button, Typography } from "@mui/material";
import { apiClient } from "../utils";
import { useMutation, useQueryClient } from "@tanstack/react-query";

export default function CompetitionDeleteButton({ name }: { name: string }) {
  const queryClient = useQueryClient();
  const mutation = useMutation({
    mutationFn: (name: string) =>
      apiClient.DELETE("/competitions/{name}", {
        params: { path: { name: name } },
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/competitions/"] });
    },
  });

  return (
    <Button onClick={() => mutation.mutate(name)} disabled={mutation.isPending}>
      {mutation.isSuccess ? (
        <Typography>Deleted!</Typography>
      ) : (
        <Typography>Delete {name}</Typography>
      )}
    </Button>
  );
}
