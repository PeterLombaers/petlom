import { EditProps } from "@/table/types";
import { CategoryNames, CategorySelect } from "./CategorySelect";

/** A competition's post categories on the club website. */
export const clubSiteCategoriesCell = {
  renderValue: ({ value }: { value: number[] }) => (
    <CategoryNames ids={value} />
  ),
  renderEdit: (props: EditProps<number[]>) => <CategorySelect {...props} />,
};
