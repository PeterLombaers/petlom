import type { components } from "./client/schema";

type CompetitionProps = components["schemas"]["CompetitionPublic"];

export function Competition(props: CompetitionProps) {
  const { name, type, created_at, updated_at } = props;
  return (
    <article className="container competition">
      <h2>{name}</h2>
      <p>Type: {type}</p>
      <p>Last Updated: {updated_at}</p>
      <p>Created: {created_at}</p>
    </article>
  );
}
