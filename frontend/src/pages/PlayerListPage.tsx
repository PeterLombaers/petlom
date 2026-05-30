import { useTranslation } from "react-i18next";
import PlayerTable from "@/players/PlayerTable";
import { useDocumentTitle } from "@/hooks/useDocumentTitle";

export default function PlayerListPage() {
  const { t } = useTranslation();
  const title = t("pageTitle.players");
  useDocumentTitle(title);
  return (
    <>
      <h1 className="sr-only">{title}</h1>
      <PlayerTable />
    </>
  );
}
