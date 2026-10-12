import { MultiSelect, Text } from "@mantine/core";
import { useTranslation } from "react-i18next";
import { useAuth } from "@/auth";
import { EditProps } from "@/table/types";
import { useClubSiteCategories } from "./usePublication";

/** The categories by name; by id while the names are unknown. */
export function CategoryNames({ ids }: { ids: number[] }) {
  const { isModerator } = useAuth();
  const { data: categories } = useClubSiteCategories({ enabled: isModerator });
  if (ids.length === 0) return null;
  const names = new Map(categories?.map((c) => [c.id, c.name]));
  return (
    <Text size="sm">
      {ids.map((id) => names.get(id) ?? `#${id}`).join(", ")}
    </Text>
  );
}

export function CategorySelect({ editValue, onChange }: EditProps<number[]>) {
  const { t } = useTranslation();
  const { isModerator } = useAuth();
  const { data: categories, isPending } = useClubSiteCategories({
    enabled: isModerator,
  });
  // Every chosen id stays an option, so one the site no longer lists can
  // still be removed.
  const known = new Set(categories?.map((c) => c.id));
  const data = [
    ...(categories ?? []).map((c) => ({ value: String(c.id), label: c.name })),
    ...editValue
      .filter((id) => !known.has(id))
      .map((id) => ({ value: String(id), label: `#${id}` })),
  ];
  return (
    <MultiSelect
      aria-label={t("clubSite.categories")}
      data={data}
      value={editValue.map(String)}
      onChange={(values) => onChange(values.map(Number))}
      searchable
      disabled={isPending && isModerator}
      comboboxProps={{ withinPortal: true }}
    />
  );
}
