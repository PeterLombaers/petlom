import { useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useDocumentTitle } from "@/pages/useDocumentTitle";

export default function PlayerDetailPage() {
  const { playerId } = useParams();
  const { t } = useTranslation();
  const title = t("pageTitle.playerDetail", { name: playerId ?? "" });
  useDocumentTitle(title);
  return (
    <>
      <h1 className="sr-only">{title}</h1>
      <div>PlayerDetailPage {playerId}</div>
    </>
  );
}
