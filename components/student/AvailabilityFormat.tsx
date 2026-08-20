"use client";

import { useTranslations } from "next-intl";
import { formatMilitaryToStandardTime } from "@/lib/utils";

// Single Availability component that takes an array and formats it
const Availability = ({
  availability,
  card,
}: {
  availability: { day: string; startTime: string; endTime: string }[];
  card: boolean;
}) => {
  const t = useTranslations("student.availabilityFormat");

  return (
    <div>
      <ul className={card ? "text-sm text-muted-foreground" : "text-xs"}>
        {availability?.map((entry, index) => (
          <li key={index}>
            <span className="font-semibold">{entry.day}s:</span>{" "}
            {formatMilitaryToStandardTime(entry.startTime)}-
            {formatMilitaryToStandardTime(entry.endTime)} {t("timezone")}
          </li>
        ))}
      </ul>
    </div>
  );
};

export default Availability;
