import { ChatRoom } from "@/components/chat/chat-room";
import { config } from "@/config";
import { createClient } from "@/lib/supabase/server";

interface Props {
  params: { id: string };
}

export default async function PairingChatRoomPage({ params }: Props) {
  const { supabase: supabaseConfig } = config;

  const supabase = await createClient();
  const user = await supabase.auth.getUser();
  if (!user.data.user?.id) {
    return null;
  }

  return (
    <main className="container mx-auto p-4">
      <h1 className="text-2xl font-bold mb-6">Tutoring Session</h1>

      <ChatRoom
        type="pairing"
        roomId={params.id}
        supabaseUrl={supabaseConfig.url!}
        supabaseKey={supabaseConfig.key!}
      />
    </main>
  );
}
