import { Card, Link, Typography } from "@mui/material";
import type { components } from "../client/schema";
import CompetitionDeleteButton from "./CompetitionDeleteButton";

type CompetitionProps = components["schemas"]["CompetitionPublic"];

export function Competition(props: CompetitionProps) {
  const { name, type, created_at: createdAt, updated_at: updatedAt } = props;
  const parsedCreatedDate = new Date(Date.parse(createdAt));
  const parsedUpdatedDate = new Date(Date.parse(updatedAt));
  return (
    <Card style={{ padding: "1rem" }}>
      <Link>{name}</Link>
      <Typography variant="subtitle2">Type: {type}</Typography>
      <Typography variant="subtitle2">
        Created: {parsedCreatedDate.toDateString()}
      </Typography>
      <Typography variant="subtitle2">
        Created: {parsedUpdatedDate.toDateString()}
      </Typography>
      <CompetitionDeleteButton name={name} />
    </Card>
  );
}
