"use client";
import { useTranslations } from "next-intl";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Profile } from "@/types";

interface TimeZoneSelectorProps {
  profile: Partial<Profile> | null;
  handleTimeZone: (value: string) => void;
}

const TimeZoneSelector = ({ profile, handleTimeZone }: TimeZoneSelectorProps) => {
  const t = useTranslations("adminPeople.timezoneSelector");

  return (
    <Select name="timeZone" value={profile?.timeZone} onValueChange={handleTimeZone}>
      <SelectTrigger className="w-full">
        <SelectValue placeholder="" />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="UTC-10">{t("hawaiian")}</SelectItem>
        <SelectItem value="UTC-09">{t("alaskan")}</SelectItem>
        <SelectItem value="UTC-08">{t("pacific")}</SelectItem>
        <SelectItem value="UTC-07">{t("mountain")}</SelectItem>
        <SelectItem value="UTC-06">{t("central")}</SelectItem>
        <SelectItem value="UTC-05">{t("eastern")}</SelectItem>
        <SelectItem value="UTC-04">{t("puertoRican")}</SelectItem>
        <SelectItem value="UTC">{t("gmt")}</SelectItem>
        <SelectItem value="UTC+01">{t("centralEuropean")}</SelectItem>
        <SelectItem value="UTC+02">{t("easternEuropean")}</SelectItem>
        <SelectItem value="UTC+03">{t("easternEuropeanSummer")}</SelectItem>
        <SelectItem value="UTC+04">{t("moscow")}</SelectItem>
        <SelectItem value="UTC+05">{t("pakistan")}</SelectItem>
        <SelectItem value="UTC+05:30">{t("indian")}</SelectItem>
        <SelectItem value="UTC+06">{t("bangladesh")}</SelectItem>
        <SelectItem value="UTC+07">{t("indochina")}</SelectItem>
        <SelectItem value="UTC+8">{t("china")}</SelectItem>
        <SelectItem value="UTC+9">{t("japan")}</SelectItem>
        <SelectItem value="UTC+10">{t("australianEastern")}</SelectItem>
      </SelectContent>
    </Select>
  );
};

export default TimeZoneSelector;
