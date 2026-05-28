import { ChatRoom, type User, type Message } from "@/components/chat/chat-room";
import { config } from "@/config";
import { getPairingFromEnrollmentId } from "@/lib/actions/pairing.server.actions";
import { createClient } from "@/lib/supabase/server";

interface Props {
  params: Promise<{ id: string }>;
}

export default async function ChatRoomPage(props: Props) {
  const params = await props.params;
  // In a real app, these would come from your authentication system and API

  const mockMessages: Message[] = [];
  const supabase = await createClient();
  const user = await supabase.auth.getUser();
  const userId = user.data.user?.id;

  const pairingId: string = await getPairingFromEnrollmentId(params.id);

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
