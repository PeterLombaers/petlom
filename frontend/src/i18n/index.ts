import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import en from "./en";
import nl from "./nl";

const savedLanguage = localStorage.getItem("petlom_language") ?? "en";

i18n.use(initReactI18next).init({
  resources: {
    en: { translation: en },
    nl: { translation: nl },
  },
  lng: savedLanguage,
  fallbackLng: "en",
  interpolation: {
    escapeValue: false,
  },
});

i18n.on("languageChanged", (lng) => {
  localStorage.setItem("petlom_language", lng);
});

export default i18n;
