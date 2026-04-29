import { SegmentedControl } from "@mantine/core";
import { components } from "@client/schema";

type Result = components["schemas"]["Result"];
type ResultToggleProps = {
  result: Result | null;
  setResult: (value: Result | null) => void;
};

const RESULT_OPTIONS = [
  { label: "1-0", value: "1-0" },
  { label: "½-½", value: "1/2-1/2" },
  { label: "0-1", value: "0-1" },
  { label: "---", value: "null" },
];

export default function ResultToggle({ result, setResult }: ResultToggleProps) {
  const handleChange = (value: string) => {
    setResult(value === "null" ? null : (value as Result));
  };

  return (
    <SegmentedControl
      value={result === null ? "null" : result}
      onChange={handleChange}
      data={RESULT_OPTIONS}
    />
  );
}
