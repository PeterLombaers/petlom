import { useTranslation } from "react-i18next";
import { useDocumentTitle } from "@/hooks/useDocumentTitle";

export default function NotFoundPage() {
  const { t } = useTranslation();
  const title = t("pageTitle.notFound");
  useDocumentTitle(title);
  return (
    <>
      <h1 className="sr-only">{title}</h1>
      <div>{t("common.notFound")}</div>
    </>
  );
}
