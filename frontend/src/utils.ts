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

export function pluralize(noun: string): string {
  // words ending in s, x, z, ch, sh → add "es"
  if (/(s|x|z|ch|sh)$/i.test(noun)) {
    return noun + "es";
  }

  // words ending in consonant + y → replace "y" with "ies"
  if (/[bcdfghjklmnpqrstvwxyz]y$/i.test(noun)) {
    return noun.replace(/y$/i, "ies");
  }

  // words ending in "f" or "fe" → replace with "ves"
  if (/(f|fe)$/i.test(noun)) {
    return noun.replace(/(f|fe)$/i, "ves");
  }

  // default → add "s"
  return noun + "s";
}
