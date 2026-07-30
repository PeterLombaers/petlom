import { useTranslation } from "react-i18next";
import CompetitionTable from "@/competitions/CompetitionTable";
import { useDocumentTitle } from "@/pages/useDocumentTitle";

export default function CompetitionListPage() {
  const { t } = useTranslation();
  const title = t("pageTitle.competitions");
  useDocumentTitle(title);
  return (
    <>
      <h1 className="sr-only">{title}</h1>
      <CompetitionTable />
    </>
  );
}
