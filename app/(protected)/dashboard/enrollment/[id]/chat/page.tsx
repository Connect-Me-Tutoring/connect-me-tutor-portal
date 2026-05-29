import { ChatRoom, type Message } from "@/components/chat/chat-room";
import { config } from "@/config";
import { getPairingFromEnrollmentId } from "@/lib/actions/pairing.server.actions";
import { isUuidString } from "@/lib/utils";
import { notFound } from "next/navigation";

interface Props {
  params: { id: string };
}

export default async function ChatRoomPage({ params }: Props) {
  const mockMessages: Message[] = [];

  const pairingId = await getPairingFromEnrollmentId(params.id);
  if (!isUuidString(pairingId)) {
    notFound();
  }

  // In a real app, these would come from your environment variables
  const { supabase: supabaseConfig } = config;

  return (
    <main className="container mx-auto p-4">
      <h1 className="text-2xl font-bold mb-6">Tutoring Session</h1>

      <ChatRoom
        roomId={pairingId}
        supabaseUrl={supabaseConfig.url}
        supabaseKey={supabaseConfig.key}
        initialMessages={mockMessages} 
        type={"pairing"}        // onSendMessage={(message) => console.log("Message sent:", message)}
        // onFileUpload={(file) => console.log("File uploaded:", file.name)}
      />
    </main>
  );
}
