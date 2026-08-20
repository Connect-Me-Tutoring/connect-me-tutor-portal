import { getTranslations } from "next-intl/server";

export default async function ContactPage() {
  const t = await getTranslations("dashboardMisc.contact");

  return <main>{t("heading")}</main>;
}
