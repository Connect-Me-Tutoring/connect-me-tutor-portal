"use client";

import type React from "react";

import { useState, useEffect, useRef } from "react";
// import { useToast } from "@/hooks/use-toast"
import { Send, PaperclipIcon, X, Download, Megaphone } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { useFetchProfile } from "@/hooks/auth";
import { createClientComponentClient } from "@supabase/auth-helpers-nextjs";
import {
  fetchAdmins,
  getChatRoomEmailMutedState,
  sendChatMessage,
  setChatRoomEmailMuted,
} from "@/lib/actions/chat.server.actions";
import { usePairing } from "@/hooks/pairings";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";

// Types for our chat components
export type User = {
  id: string;
  name: string;
  avatar_url?: string;
  role: "tutor" | "student" | "admin";
  online?: boolean;
};

export type Message = {
  id: string;
  user_id: string;
  room_id: string;
  content: string;
  created_at: string;
  file?: {
    name: string;
    url: string;
    type: string;
    size: number;
  };
};

export type ChatRoomProps = {
  roomId: string;
  roomName?: string;
  /** Legacy props; chat uses the authenticated browser Supabase client. */
  supabaseUrl?: string;
  supabaseKey?: string;
  initialMessages?: Message[];
  initialUsers?: User[];
  onSendMessage?: (message: string) => void;
  onFileUpload?: (file: File) => void;
  type: "pairing" | "announcements" | "admin";
};

export function ChatRoom({
  roomId,
  roomName,
  initialMessages = [],
  initialUsers = [],
  onSendMessage,
  onFileUpload,
  type,
}: ChatRoomProps) {
  const [messages, setMessages] = useState<Message[]>(initialMessages);
  const [users, setUsers] = useState<Record<string, User>>({});
  const [messageInput, setMessageInput] = useState("");
  const [isLoadingMessages, setIsLoadingMessages] = useState(true);
  const [isLoadingUsers, setIsLoadingUsers] = useState(true);
  const [uploadingFiles, setUploadingFiles] = useState<{
    [key: string]: number;
  }>({});
  const [emailMuted, setEmailMuted] = useState(false);
  const [emailMuteLoading, setEmailMuteLoading] = useState(true);

  const { pairing } = usePairing(roomId);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const supabase = createClientComponentClient();
  const { profile } = useFetchProfile();

  // Computed loading states
  const isLoading = isLoadingMessages || isLoadingUsers;
  const hasUsers = Object.keys(users).length > 0;
  const canShowMessages = !isLoading && hasUsers;

  // Scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Fetch users effect
  useEffect(() => {
    let isMounted = true;

    const fetchUsers = async () => {
      try {
        setIsLoadingUsers(true);

        if (pairing) {
          const administrators = await fetchAdmins();

          const adminUsers =
            administrators?.reduce(
              (acc, admin) => {
                acc[admin.id] = {
                  role: "admin",
                  id: admin.id,
                  name: `${admin.first_name} ${admin.last_name}`,
                };
                return acc;
              },
              {} as Record<string, User>,
            ) || {};

          const chatRoomUsers = {
            [pairing.tutor.id]: {
              role: "tutor",
              id: pairing.tutor.id,
              name: `${pairing.tutor.first_name} ${pairing.tutor.last_name}`,
            },
            [pairing.student.id]: {
              role: "student",
              id: pairing.student.id,
              name: `${pairing.student.first_name} ${pairing.student.last_name}`,
            },
            ...adminUsers,
          };

          if (isMounted) {
            setUsers(chatRoomUsers);
          }
        } else if (type === "announcements" || type === "admin") {
          const administrators = await fetchAdmins();

          const adminUsers =
            administrators?.reduce(
              (acc, admin) => {
                acc[admin.id] = {
                  role: "admin",
                  id: admin.id,
                  name: `${admin.first_name} ${admin.last_name}`,
                };
                return acc;
              },
              {} as Record<string, User>,
            ) || {};

          if (isMounted && profile) {
            setUsers({
              ...adminUsers,
              [profile.id]: {
                id: profile.id,
                name: `${profile.firstName} ${profile.lastName}`,
                role: profile.role.toLowerCase(),
              },
            });
          }
        }
      } catch (error) {
        console.error("Error fetching users:", error);
      } finally {
        if (isMounted) {
          setIsLoadingUsers(false);
        }
      }
    };

    // Only fetch users if we have pairing or it's announcements

    fetchUsers();

    return () => {
      isMounted = false;
    };
  }, [pairing, type, profile]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        setEmailMuteLoading(true);
        const { muted } = await getChatRoomEmailMutedState(roomId);
        if (!cancelled) setEmailMuted(muted);
      } catch (e) {
        console.error("Error loading chat email mute state:", e);
      } finally {
        if (!cancelled) setEmailMuteLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [roomId, profile?.id]);

  // Load messages and set up subscriptions
  useEffect(() => {
    let isMounted = true;
    let messagesSubscription: any = null;

    const loadMessages = async () => {
      try {
        setIsLoadingMessages(true);

        // Fetch messages for this room
        const { data, error } = await supabase
          .from("messages")
          .select("*")
          .eq("room_id", roomId)
          .order("created_at", { ascending: true });

        if (error) throw error;

        if (data && isMounted) {
          setMessages(data as Message[]);
        }
      } catch (error) {
        console.error("Error loading messages:", error);
      } finally {
        if (isMounted) {
          setIsLoadingMessages(false);
        }
      }
    };

    const setupSubscription = () => {
      // Subscribe to new messages
      messagesSubscription = supabase
        .channel(`messages:${roomId}`)
        .on(
          "postgres_changes",
          {
            event: "INSERT",
            schema: "public",
            table: "messages",
            filter: `room_id=eq.${roomId}`,
          },
          (payload) => {
            if (isMounted) {
              const newMessage = payload.new as Message;
              setMessages((prev) => [...prev, newMessage]);
            }
          },
        )
        .subscribe();
    };

    loadMessages().then(() => {
      if (isMounted) {
        setupSubscription();
      }
    });

    return () => {
      isMounted = false;
      if (messagesSubscription) {
        supabase.removeChannel(messagesSubscription);
      }
    };
  }, [roomId, supabase]);

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();

    if (
      (type === "announcements" && profile?.role !== "Admin") ||
      !messageInput.trim() ||
      !profile
    )
      return;

    try {
      const text = messageInput.trim();
      const result = await sendChatMessage({
        roomId,
        roomType: type,
        content: text,
      });

      if (!result.ok) {
        console.error("sendChatMessage:", result.error);
        return;
      }

      setMessageInput("");

      if (onSendMessage) {
        onSendMessage(text);
      }
    } catch (error) {
      console.error("Error sending message:", error);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (type === "announcements" || !profile) return;

    const files = e.target.files;
    if (!files || files.length === 0) return;

    const file = files[0];
    const fileId = `${Date.now()}-${file.name}`;

    try {
      // Start tracking upload progress
      setUploadingFiles((prev) => ({ ...prev, [fileId]: 0 }));

      // Upload file to Supabase Storage
      const filePath = `${roomId}/${profile.id}/${fileId}`;
      const { data, error } = await supabase.storage
        .from("enrollment-chat-files")
        .upload(filePath, file, {});

      if (error) throw error;

      // Get public URL for the file
      const { data: urlData } = supabase.storage
        .from("enrollment-chat-files")
        .getPublicUrl(filePath);

      const result = await sendChatMessage({
        roomId,
        roomType: type,
        content: `Shared a file: ${file.name}`,
        file: {
          name: file.name,
          url: urlData.publicUrl,
          type: file.type,
          size: file.size,
        },
      });

      if (!result.ok) throw new Error(result.error ?? "Failed to send message");

      // Remove from uploading files
      setUploadingFiles((prev) => {
        const newState = { ...prev };
        delete newState[fileId];
        return newState;
      });

      if (onFileUpload) {
        onFileUpload(file);
      }

      // Reset file input
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    } catch (error) {
      console.error("Error uploading file:", error);

      // Remove from uploading files on error
      setUploadingFiles((prev) => {
        const newState = { ...prev };
        delete newState[fileId];
        return newState;
      });
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const getUserById = (userId: string) => users[userId];

  const getInitials = (name: string) => {
    return name
      .split(" ")
      .map((part) => part[0])
      .join("")
      .toUpperCase()
      .substring(0, 2);
  };

  if (!profile) return <></>;

  return (
    <div
      className={`flex min-h-[80dvh] border rounded-lg overflow-hidden ${type === "announcements" ? "" : "bg-white"}`}
    >
      {/* Users sidebar */}

      <div
        className={`w-64 border-r hidden md:block ${type === "announcements" ? "" : "bg-gray-50"}`}
      >
        <div className="p-4 border-b">
          <div className="flex items-center gap-2">
            {type === "announcements" && <Megaphone className="h-5 w-5 " />}
            <h3 className="font-semibold text-lg">
              {type === "announcements" ? roomName : "Participants"}
            </h3>
          </div>
        </div>
        <ScrollArea className="h-full p-4">
          {isLoadingUsers ? (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <div key={i} className="flex items-center gap-3">
                  <Skeleton className="h-10 w-10 rounded-full" />
                  <div className="space-y-2">
                    <Skeleton className="h-4 w-20" />
                    <Skeleton className="h-3 w-16" />
                  </div>
                </div>
              ))}
            </div>
          ) : (
            Object.values(users).map((user) => (
              <div key={user.id} className="flex items-center gap-3 mb-3">
                <div className="relative">
                  <Avatar>
                    <AvatarImage src={user?.avatar_url || "/placeholder.svg"} />
                    <AvatarFallback>{getInitials(user.name)}</AvatarFallback>
                  </Avatar>
                  {user.online && (
                    <span className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 rounded-full border-2 border-white"></span>
                  )}
                </div>
                <div>
                  <p className="text-sm font-medium">{user.name}</p>
                  <Badge
                    variant={user.role === "tutor" ? "default" : "secondary"}
                    className="text-xs"
                  >
                    {user.role}
                  </Badge>
                </div>
              </div>
            ))
          )}
        </ScrollArea>
      </div>

      {/* Chat area */}
      <div className="flex-1 flex flex-col">
        {/* Chat header */}
        <div
          className={`p-4 border-b flex flex-col gap-3 sm:flex-row sm:justify-between sm:items-start sm:gap-4`}
        >
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              {type === "announcements" && <Megaphone className="h-5 w-5 " />}
              <h2 className="font-semibold text-lg">
                {type === "announcements"
                  ? roomName
                  : (roomName ?? `Chat Room`)}
              </h2>
            </div>
            <p className="text-sm text-gray-500">
              {type === "announcements"
                ? "Read-only announcements channel"
                : `${Object.keys(users).length} participants`}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3 justify-end shrink-0">
            <div className="flex items-center gap-2 max-w-[220px] sm:max-w-none">
              <Switch
                id={`email-mute-${roomId}`}
                checked={emailMuted}
                disabled={emailMuteLoading || !profile}
                onCheckedChange={async (checked) => {
                  setEmailMuted(checked);
                  const res = await setChatRoomEmailMuted(roomId, checked);
                  if (!res.ok) {
                    setEmailMuted(!checked);
                    console.error(res.error);
                  }
                }}
              />
              <Label
                htmlFor={`email-mute-${roomId}`}
                className="text-xs sm:text-sm text-gray-600 cursor-pointer leading-snug"
              >
                Mute email notifications for this chat
              </Label>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                const modal = document.getElementById("participants-modal");
                if (modal instanceof HTMLDialogElement) {
                  modal.showModal();
                }
              }}
              className="md:hidden"
            >
              {type === "announcements" ? "Viewers" : "Participants"}
            </Button>
          </div>
        </div>

        {/* Messages area */}
        <ScrollArea className="flex-1 p-4">
          {isLoading ? (
            <div className="space-y-4">
              {[1, 2, 3].map((i) => (
                <div key={i} className="flex items-start gap-3">
                  <Skeleton className="h-10 w-10 rounded-full" />
                  <div className="space-y-2">
                    <Skeleton className="h-4 w-[250px]" />
                    <Skeleton className="h-20 w-[300px]" />
                  </div>
                </div>
              ))}
            </div>
          ) : !hasUsers ? (
            <div className="absolute inset-0 flex items-center justify-center text-gray-400">
              <div className="text-center">
                <p className="text-sm">Unable to load participants</p>
              </div>
            </div>
          ) : messages.length === 0 ? (
            <div className="absolute inset-0 flex items-center justify-center text-gray-400">
              <div className="text-center">
                <Megaphone className="mx-auto h-8 w-8 mb-2" />
                <p className="text-sm">No messages yet</p>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              {messages
                .map((message) => {
                  const user = getUserById(message.user_id);

                  if (!user) {
                    console.warn(
                      `User not found for message: ${message.id}, user_id: ${message.user_id}`,
                    );
                    return null; // Skip rendering this message instead of throwing error
                  }

                  const isCurrentUser = message.user_id === profile.id;

                  return (
                    <div
                      key={message.id}
                      className={`flex items-start gap-3 ${isCurrentUser ? "flex-row-reverse" : ""}`}
                    >
                      <Avatar>
                        <AvatarImage
                          src={user.avatar_url || "/placeholder.svg"}
                        />
                        <AvatarFallback>
                          {getInitials(user.name)}
                        </AvatarFallback>
                      </Avatar>

                      <div
                        className={`max-w-[70%] ${isCurrentUser ? "text-right" : "text-left"}`}
                      >
                        <div className="flex items-center gap-2 mb-1">
                          <p
                            className={`text-sm font-medium ${isCurrentUser ? "ml-auto" : ""}`}
                          >
                            {user.name}
                          </p>
                          <Badge
                            variant={
                              user.role === "tutor" ? "default" : "secondary"
                            }
                            className="text-xs"
                          >
                            {user.role}
                          </Badge>
                          <span className="text-xs text-gray-500">
                            {new Date(message.created_at).toLocaleTimeString(
                              [],
                              {
                                hour: "2-digit",
                                minute: "2-digit",
                              },
                            )}
                          </span>
                        </div>

                        <div className="rounded-lg p-3 inline-block max-w-[75%] min-w-[50px]">
                          <p className="whitespace-pre-wrap break-words">
                            {message.content}
                          </p>

                          {message.file && (
                            <div className="mt-2 p-3 bg-background rounded border">
                              <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                  <PaperclipIcon className="h-4 w-4" />
                                  <span className="text-sm font-medium truncate max-w-[150px]">
                                    {message.file.name}
                                  </span>
                                </div>
                                <div className="text-xs text-gray-500">
                                  {formatFileSize(message.file.size)}
                                </div>
                              </div>
                              <a
                                href={message.file.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="mt-2 flex items-center gap-1 text-xs text-blue-600 hover:underline"
                              >
                                <Download className="h-3 w-3" />
                                Download
                              </a>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })
                .filter(Boolean)}

              {/* File upload progress indicators */}
              {Object.entries(uploadingFiles).map(([fileId, progress]) => (
                <div
                  key={fileId}
                  className="flex items-center justify-end gap-2"
                >
                  <div className="w-64 h-2 bg-gray-200 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-primary"
                      style={{ width: `${progress}%` }}
                    ></div>
                  </div>
                  <span className="text-xs">{progress}%</span>
                </div>
              ))}

              <div ref={messagesEndRef} />
            </div>
          )}
        </ScrollArea>

        {/* Message input */}
        {type === "announcements" && profile.role !== "Admin" ? (
          <div className="p-4 border-t ">
            <div className="flex items-center justify-center gap-2 ">
              <Megaphone className="h-4 w-4" />
              <span className="text-sm font-medium">
                This is a read-only announcements channel
              </span>
            </div>
          </div>
        ) : (
          <div className="p-4 border-t">
            <form onSubmit={handleSendMessage} className="flex gap-2">
              <Button
                type="button"
                size="icon"
                variant="outline"
                onClick={() => fileInputRef.current?.click()}
                disabled={isLoading}
              >
                <PaperclipIcon className="h-4 w-4" />
              </Button>
              <input
                type="file"
                ref={fileInputRef}
                onChange={handleFileUpload}
                className="hidden"
              />
              <input
                type="text"
                value={messageInput}
                onChange={(e) => setMessageInput(e.target.value)}
                placeholder="Type your message..."
                className="flex-1 border rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary"
                disabled={isLoading}
              />
              <Button
                type="submit"
                disabled={isLoading || !messageInput.trim()}
              >
                <Send className="h-4 w-4 mr-2" />
                Send
              </Button>
            </form>
          </div>
        )}
      </div>

      {/* Mobile participants modal */}
      <dialog id="participants-modal" className="modal">
        <div className="modal-box">
          <div className="flex justify-between items-center mb-4">
            <div className="flex items-center gap-2">
              {type === "announcements" && <Megaphone className="h-5 w-5 " />}
              <h3 className="font-semibold text-lg">
                {type === "announcements" ? "Viewers" : "Participants"}
              </h3>
            </div>
            <form method="dialog">
              <Button variant="ghost" size="icon">
                <X className="h-4 w-4" />
              </Button>
            </form>
          </div>
          <div className="space-y-3">
            {Object.values(users).map((user) => (
              <div key={user.id} className="flex items-center gap-3">
                <div className="relative">
                  <Avatar>
                    <AvatarImage src={user.avatar_url || "/placeholder.svg"} />
                    <AvatarFallback>{getInitials(user.name)}</AvatarFallback>
                  </Avatar>
                  {user.online && (
                    <span className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 rounded-full border-2 border-white"></span>
                  )}
                </div>
                <div>
                  <p className="text-sm font-medium">{user.name}</p>
                  <Badge
                    variant={user.role === "tutor" ? "default" : "secondary"}
                    className="text-xs"
                  >
                    {user.role}
                  </Badge>
                </div>
              </div>
            ))}
          </div>
        </div>
      </dialog>
    </div>
  );
}
