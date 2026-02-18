import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Profile } from "@/types";

import { SharedPairing } from "@/types/pairing";
import { profile } from "console";
import Link from "next/link";
import { redirect, useRouter } from "next/navigation";
import { use, useMemo } from "react";

interface ChatListProps {
  pairingsPromise: Promise<SharedPairing[] | null>;
  profilePromise: Promise<Profile | null>;
}

// Mock function to simulate unread message counts
// In a real app, this would come from your messaging system
const getUnreadCount = (pairingId: string): number => {
  const mockCounts: Record<string, number> = {
    "c95f7af1-e531-479e-86e9-14cb22e45785": 3,
    "pairing-2": 1,
    "pairing-3": 0,
    "pairing-4": 5,
  };
  return mockCounts[pairingId] || 0;
};

// Mock function to get last message
// In a real app, this would come from your messaging system
const getLastMessage = (
  pairingId: string,
): { text: string; timestamp: string } => {
  const mockMessages: Record<string, { text: string; timestamp: string }> = {
    "c95f7af1-e531-479e-86e9-14cb22e45785": {
      text: "Great progress on today's lesson!",
      timestamp: "5m",
    },
    "pairing-2": {
      text: "Let's review the homework tomorrow",
      timestamp: "1h",
    },
    "pairing-3": {
      text: "Thanks for the explanation",
      timestamp: "2h",
    },
    "pairing-4": {
      text: "Can we reschedule our session?",
      timestamp: "1d",
    },
  };
  return (
    mockMessages[pairingId] || {
      text: "Start a conversation",
      timestamp: "now",
    }
  );
};

// Generate avatar URL based on name
const getAvatarUrl = (name: string): string => {
  return `/placeholder.svg?height=48&width=48&text=${encodeURIComponent(name.charAt(0))}`;
};

// Format date for display
const formatDate = (dateString: string): string => {
  const date = new Date(dateString);
  const now = new Date();
  const diffInHours = (now.getTime() - date.getTime()) / (1000 * 60 * 60);

  if (diffInHours < 1) {
    return `${Math.floor(diffInHours * 60)}m`;
  } else if (diffInHours < 24) {
    return `${Math.floor(diffInHours)}h`;
  } else {
    return `${Math.floor(diffInHours / 24)}d`;
  }
};

export function ChatList({ pairingsPromise, profilePromise }: ChatListProps) {
  const pairings = use(pairingsPromise) || [];
  const profile = use(profilePromise);
  if (!profile) {
    redirect("/");
  }
  const role = profile.role;

  const clientConversations = useMemo(
    () =>
      pairings.map((pairing) => {
        const profile =
          role === "Student" ? pairing["tutor"] : pairing["student"];
        return {
          id: profile.id,
          name: `${profile.first_name}  ${profile.last_name}`,
          email: profile.email,
          //   startDate: pairing.start_date,
          //   endDate: pairing.end_date,
          pairingId: pairing.id,
        };
      }),
    // const d
    [pairings, role],
  );
  return (
    <div className="flex flex-col h-screen">
      {/* Header */}
      <div className="p-4 border-b border-gray-100">
        <h1 className="text-xl font-semibold text-gray-900">Messages</h1>
        <p className="text-sm text-gray-500 mt-1">
          {pairings.length} active tutoring session
          {pairings.length !== 1 ? "s" : ""}
        </p>
      </div>

      {/* Chat List */}
      <div className="flex-1 overflow-y-auto">
        {pairings.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full p-8 text-center">
            <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mb-4">
              <svg
                className="w-8 h-8 text-gray-400"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
                />
              </svg>
            </div>
            <h3 className="text-lg font-medium text-gray-900 mb-2">
              No active sessions
            </h3>
            <p className="text-gray-500">
              Your tutoring conversations will appear here
            </p>
          </div>
        ) : (
          clientConversations.map((conversation) => {
            const lastMessage = getLastMessage(conversation.id);
            const unreadCount = getUnreadCount(conversation.id);
            const isActive = new Date() > new Date();

            return (
              <Link
                href={`/dashboard/pairings/${conversation.pairingId}/chat`}
                key={conversation.name}
                className="flex items-center p-4 hover:bg-gray-50 cursor-pointer border-b border-gray-50 transition-colors"
              >
                {/* Tutor Avatar */}
                <div className="relative mr-3">
                  <Avatar className="h-12 w-12">
                    <AvatarImage
                      src={
                        getAvatarUrl(conversation.name) || "/placeholder.svg"
                      }
                      alt={conversation.name}
                    />
                    <AvatarFallback className="bg-blue-100 text-blue-600 font-medium">
                      {conversation.name.charAt(0).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  {isActive && (
                    <div className="absolute -bottom-0.5 -right-0.5 w-4 h-4 bg-green-500 border-2 border-white rounded-full"></div>
                  )}
                </div>

                {/* Chat Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center">
                      <h3 className="font-medium text-gray-900 truncate">
                        {conversation.name}
                      </h3>
                      <span className="text-xs text-gray-400 ml-2">Tutor</span>
                    </div>
                    <span className="text-xs text-gray-500 ml-2">
                      {lastMessage.timestamp}
                    </span>
                  </div>

                  <p className="text-sm text-gray-600 truncate mb-2">
                    {lastMessage.text}
                  </p>

                  <div className="flex items-center justify-between">
                    <div className="flex items-center text-xs text-gray-500">
                      <svg
                        className="w-3 h-3 mr-1"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
                        />
                      </svg>
                      {/* {conversation.duration}h sessions
                      {conversation.summer_paused && (
                        <span className="ml-2 px-1.5 py-0.5 bg-yellow-100 text-yellow-700 rounded text-xs">
                          Paused
                        </span>
                      )} */}
                    </div>

                    {unreadCount > 0 && (
                      <Badge
                        variant="default"
                        className="bg-blue-500 hover:bg-blue-600 text-white text-xs px-2 py-1 min-w-[20px] h-5 flex items-center justify-center"
                      >
                        {unreadCount > 99 ? "99+" : unreadCount}
                      </Badge>
                    )}
                  </div>
                </div>
              </Link>
            );
          })
        )}
      </div>
    </div>
  );
}
