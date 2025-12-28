import { components } from "@client/schema";

type Result = components["schemas"]["Result"];

export function resultToString(result: Result | null): string {
  if (result === null) {
    return "---";
  } else if (result === "1/2-1/2") {
    return "½-½";
  } else {
    return result;
  }
}
