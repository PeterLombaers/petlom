import type { TFunction } from "i18next";

export function translateEntity(
  t: TFunction,
  entityType: string,
  plural = false,
): string {
  const key = plural
    ? `entityType.${entityType}_plural`
    : `entityType.${entityType}`;
  return t(key as never, {
    defaultValue: plural ? `${entityType}s` : entityType,
  });
}
