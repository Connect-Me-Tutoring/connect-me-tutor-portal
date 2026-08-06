"use client";
import { supabase } from "@/lib/supabase/client";
import { Notification } from "@/types";
import { tableToInterfaceProfiles } from "../type-utils";

export async function getAllNotifications(): Promise<Notification[] | null> {
  try {
    const { data, error } = await supabase.from("Notifications").select(`
        id,
        created_at,
        session_id,
        previous_date,
        suggested_date,
        tutor_id,
        student_id,
        status,
        summary,
        student:Profiles!student_id(*),
        tutor:Profiles!tutor_id(*)
      `);

    if (error) {
      console.error("Error fetching notification details:", error.message);
      return null;
    }

    if (!data) return null;

    const notifications: Notification[] = data.map((notification: any) => ({
      createdAt: notification.created_at,
      id: notification.id,
      summary: notification.summary,
      sessionId: notification.session_id,
      previousDate: notification.previous_date,
      suggestedDate: notification.suggested_date,
      student: tableToInterfaceProfiles(notification.student_id),
      tutor: tableToInterfaceProfiles(notification.tutor_id),
      status: notification.status,
    }));

    return notifications;
  } catch (error) {
    console.error("Unexpected error in getAllNotifications:", error);
    return null;
  }
}

export const updateNotification = async (
  notificationId: string,
  status: "Active" | "Resolved",
) => {
  try {
    const { data, error } = await supabase
      .from("Notifications")
      .update({ status: status })
      .eq("id", notificationId);

    if (error) throw error;
    return data;
  } catch (error) {
    console.error("Error updating notification:", error);
    throw new Error("Failed to update notification");
  }
};