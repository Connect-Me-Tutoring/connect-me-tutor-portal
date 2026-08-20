"use client";

import { useLocale, useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { Languages } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { setUserLocale } from "@/i18n/locale";
import { locales, type Locale } from "@/i18n/config";

export function LanguageSwitcher() {
  const locale = useLocale();
  const t = useTranslations("common.languageSwitcher");
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const localeLabels: Record<Locale, string> = {
    en: t("english"),
    es: t("spanish"),
  };

  const handleChange = (nextLocale: string) => {
    startTransition(async () => {
      await setUserLocale(nextLocale as Locale);
      router.refresh();
    });
  };

  return (
    <Select value={locale} onValueChange={handleChange} disabled={isPending}>
      <SelectTrigger aria-label={t("label")} className="w-auto gap-2">
        <Languages className="h-4 w-4" />
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {locales.map((value) => (
          <SelectItem key={value} value={value}>
            {localeLabels[value]}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
