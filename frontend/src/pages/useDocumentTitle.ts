import { useEffect } from "react";
import { useTranslation } from "react-i18next";

export function useDocumentTitle(title: string | undefined) {
  const { t } = useTranslation();
  useEffect(() => {
    if (!title) return;
    document.title = `${title} · ${t("a11y.titleSuffix")}`;
  }, [title, t]);
}
