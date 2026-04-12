"use client";

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
import { config } from "@/config";
import {
  StudentAnnouncementsRoomId,
  TutorAnnouncementRoomId,
} from "@/constants/chat";
import { useFetchProfile } from "@/hooks/auth";
import { useEffect, useState } from "react";

type AnnouncementsRooms = "tutors" | "students" | "all";

export default function AnnouncementsPage() {
  const [currentRoom, setCurrentRoom] = useState<AnnouncementsRooms>("tutors");
  const { profile } = useFetchProfile();
  const [roomID, setRoomID] = useState<string>(TutorAnnouncementRoomId);
  useEffect(() => {
    if (profile && profile.role !== "Admin") {
      setCurrentRoom(profile.role === "Tutor" ? "tutors" : "students");
    }
  }, [profile]);

  useEffect(() => {
    setRoomID(
      currentRoom === "students"
        ? StudentAnnouncementsRoomId
        : TutorAnnouncementRoomId
    );
  }, [currentRoom]);
  if (!profile || !roomID) return <>Loading...</>;
  // const { supabase: supabaseConfig } = config;

  return (
    <main className="h-[90dvh] p-4">
      {profile.role === "Admin" && (
        <div>
          <Select
            value={currentRoom}
            onValueChange={(value) =>
              setCurrentRoom(value as AnnouncementsRooms)
            }
          >
            <SelectTrigger className="">
              <SelectValue placeholder="Announcements Room" />
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>
                <SelectLabel>Announcement Rooms</SelectLabel>
                <SelectItem value="all">All</SelectItem>
                <SelectItem value="tutors">Tutors</SelectItem>
                <SelectItem value="students">Students</SelectItem>
              </SelectGroup>
            </SelectContent>
          </Select>
        </div>
      )}

      <div className="h-full pb-5 ">
        <ChatRoom
          type="announcements"
          roomName={`${currentRoom === "students" ? "Student" : "Tutor"} Announcements`}
          roomId={roomID}
          supabaseUrl={config.supabase.url!}
          supabaseKey={config.supabase.key!}
        />
      </div>
    </main>
  );
}
