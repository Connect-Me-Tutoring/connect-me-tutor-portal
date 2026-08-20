"use client";

import { useTranslations } from "next-intl";
import { ChatRoom } from "@/components/chat/chat-room";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { StudentAnnouncementsRoomId, TutorAnnouncementRoomId } from "@/constants/chat";
import { useFetchProfile } from "@/hooks/auth";
import { useEffect, useState } from "react";

type AnnouncementsRooms = "tutors" | "students" | "all";

export default function AnnouncementsPage() {
  const t = useTranslations("adminOps.announcements");
  const [currentRoom, setCurrentRoom] = useState<AnnouncementsRooms>("tutors");
  const { profile } = useFetchProfile();
  const [roomID, setRoomID] = useState<string>(TutorAnnouncementRoomId);
  useEffect(() => {
    if (profile && profile.role !== "Admin") {
      setCurrentRoom(profile.role === "Tutor" ? "tutors" : "students");
    }
  }, [profile]);

  useEffect(() => {
    setRoomID(currentRoom === "students" ? StudentAnnouncementsRoomId : TutorAnnouncementRoomId);
  }, [currentRoom]);
  if (!profile || !roomID) return <>{t("loading")}</>;
  // const { supabase: supabaseConfig } = config;

  return (
    <main className="h-[90dvh] p-4">
      {profile.role === "Admin" && (
        <div>
          <Select
            value={currentRoom}
            onValueChange={(value) => setCurrentRoom(value as AnnouncementsRooms)}
          >
            <SelectTrigger className="">
              <SelectValue placeholder={t("roomPlaceholder")} />
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>
                <SelectLabel>{t("roomGroupLabel")}</SelectLabel>
                <SelectItem value="all">{t("rooms.all")}</SelectItem>
                <SelectItem value="tutors">{t("rooms.tutors")}</SelectItem>
                <SelectItem value="students">{t("rooms.students")}</SelectItem>
              </SelectGroup>
            </SelectContent>
          </Select>
        </div>
      )}

      <div className="h-full pb-5 ">
        <ChatRoom
          type="announcements"
          roomName={
            currentRoom === "tutors"
              ? t("roomNames.tutor")
              : currentRoom === "students"
                ? t("roomNames.student")
                : t("roomNames.all")
          }
          roomId={roomID}
        />
      </div>
    </main>
  );
}
