import { ChatRoom, type User, type Message } from "@/components/chat/chat-room";
import { config } from "@/config";
import { getPairingFromEnrollmentId } from "@/lib/actions/pairing.server.actions";
import { createClient } from "@/lib/supabase/server";

interface Props {
  params: { id: string };
}

export default async function ChatRoomPage({ params }: Props) {
  // In a real app, these would come from your authentication system and API
  const currentUser: User = {
    id: "user-1",
    name: "John Doe",
    avatar_url: "/placeholder.svg?height=40&width=40",
    role: "student",
    online: true,
  };

  const mockUsers: User[] = [
    currentUser,
    {
      id: "user-2",
      name: "Dr. Sarah Smith",
      avatar_url: "/placeholder.svg?height=40&width=40",
      role: "tutor",
      online: true,
    },
    {
      id: "user-3",
      name: "Mike Johnson",
      avatar_url: "/placeholder.svg?height=40&width=40",
      role: "student",
      online: false,
    },
    {
      id: "user-4",
      name: "Emma Wilson",
      avatar_url: "/placeholder.svg?height=40&width=40",
      role: "student",
      online: true,
    },
  ];

  const mockMessages: Message[] = [];
  const supabase = await createClient();
  const user = await supabase.auth.getUser();
  const userId = user.data.user?.id;

  // const pairingId: string = await getPairingFromEnrollmentId(params.id);

  // In a real app, these would come from your environment variables
  const { supabase: supabaseConfig } = config;

  return (
    <main className="container mx-auto p-4">
      <h1 className="text-2xl font-bold mb-6">Tutoring Session</h1>

      <ChatRoom
        type="pairing"
        roomId={params.id}
        supabaseUrl={supabaseConfig.url}
        supabaseKey={supabaseConfig.key}
        initialMessages={mockMessages}
        initialUsers={mockUsers}
        // onSendMessage={(message) => console.log("Message sent:", message)}
        // onFileUpload={(file) => console.log("File uploaded:", file.name)}
      />
    </main>
  );
}
