import type { TranslationSchema } from "./en";

declare module "i18next" {
  interface CustomTypeOptions {
    defaultNS: "translation";
    resources: {
      translation: TranslationSchema;
    };
  }
}
