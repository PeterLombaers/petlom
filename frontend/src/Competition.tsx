import { Card, Container, Link, Typography } from "@mui/material";
import type { components } from "./client/schema";

type CompetitionProps = components["schemas"]["CompetitionPublic"];

export function Competition(props: CompetitionProps) {
  const { name, type, created_at, updated_at } = props;
  return (
    <Container maxWidth="sm">
      <Card>
        <Link>{name}</Link>
        <Typography variant="subtitle2">Type: {type}</Typography>
        <Typography variant="subtitle2">Last Updated: {updated_at}</Typography>
        <Typography variant="subtitle2">Created: {created_at}</Typography>
      </Card>
    </Container>
  );
}
