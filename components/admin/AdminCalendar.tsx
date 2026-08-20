import React, { useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useTranslations } from "next-intl";
import { Session } from "@/types";

interface StudentCalendarProps {
  sessions: Session[];
}

export default function StudentCalendar({ sessions }: StudentCalendarProps) {
  const t = useTranslations("adminSchedule.calendar");
  const daysOfWeekKeys = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"] as const;
  const currentDate = new Date();

  const [currentMonth, setCurrentMonth] = useState(currentDate.getMonth());
  const [currentYear, setCurrentYear] = useState(currentDate.getFullYear());

  const monthName = new Date(currentYear, currentMonth).toLocaleString("default", {
    month: "long",
  });

  const generateCalendarDays = () => {
    const firstDay = new Date(currentYear, currentMonth, 1).getDay();
    const lastDate = new Date(currentYear, currentMonth + 1, 0).getDate();
    const days = [];

    for (let i = 0; i < firstDay; i++) {
      days.push(<div key={`empty-${i}`} className="text-center p-2"></div>);
    }

    for (let i = 1; i <= lastDate; i++) {
      const currentDate = new Date(currentYear, currentMonth, i);
      const isToday =
        i === new Date().getDate() &&
        currentMonth === new Date().getMonth() &&
        currentYear === new Date().getFullYear();
      const sessionsOnThisDay = sessions.filter(
        (session) => new Date(session.date).toDateString() === currentDate.toDateString(),
      );
      const hasSession = sessionsOnThisDay.length > 0;

      days.push(
        <div
          key={i}
          className={`text-center p-2 relative ${isToday ? "bg-orange-500 text-white rounded-full" : ""}`}
        >
          {i}
          {hasSession && (
            <div
              className="absolute top-1 left-1/2 transform -translate-x-1/2 -translate-y-1/2 bottom-1 w-2 h-2 bg-orange-500 rounded-full"
              title={sessionsOnThisDay
                .map((session) =>
                  t("meetingWith", {
                    name: `${session.tutor?.firstName} ${session.tutor?.lastName}`,
                  }),
                )
                .join(", ")} // Display sessionname(s) as tooltip
            ></div>
          )}
          {hasSession && (
            <div className="absolute bottom-6 left-1/2 transform -translate-x-1/2 bg-gray-700 text-white text-xs rounded-lg p-1 opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none">
              {sessionsOnThisDay.map((session) => session.tutor?.firstName).join(", ")}
            </div>
          )}
        </div>,
      );
    }

    return days;
  };

  const handlePreviousMonth = () => {
    if (currentMonth === 0) {
      setCurrentMonth(11);
      setCurrentYear(currentYear - 1);
    } else {
      setCurrentMonth(currentMonth - 1);
    }
  };

  const handleNextMonth = () => {
    if (currentMonth === 11) {
      setCurrentMonth(0);
      setCurrentYear(currentYear + 1);
    } else {
      setCurrentMonth(currentMonth + 1);
    }
  };

  return (
    <div className="bg-white rounded-lg shadow p-4">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-lg font-semibold">{`${monthName} ${currentYear}`}</h2>
        <div className="flex space-x-2">
          <button onClick={handlePreviousMonth} className="p-1 rounded-full hover:bg-gray-200">
            <ChevronLeft size={20} />
          </button>
          <button onClick={handleNextMonth} className="p-1 rounded-full hover:bg-gray-200">
            <ChevronRight size={20} />
          </button>
        </div>
      </div>
      <div className="grid grid-cols-7 gap-1">
        {daysOfWeekKeys.map((day) => (
          <div key={day} className="text-center font-medium text-gray-500">
            {t(`daysOfWeek.${day}`)}
          </div>
        ))}
        {generateCalendarDays()}
      </div>
    </div>
  );
}
