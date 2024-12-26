export type CompetitionProps = {
  name: string;
  type: "simkro";
  created_at: Date;
  updated_at: Date;
  matches?: any[];
};

export function Competition(props: CompetitionProps) {
  const { name, type, created_at, updated_at } = props;
  return (
    <article className="container competition">
      <h2>{name}</h2>
      <p>Type: {type}</p>
      <p>Last Updated: {updated_at.toDateString()}</p>
      <p>Created: {created_at.toDateString()}</p>
    </article>
  );
}
