import { ChatRoom } from "@/components/chat/chat-room";
import { config } from "@/config";
import { isUuidString } from "@/lib/utils";
import { createClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";

interface Props {
  params: Promise<{ id: string }>;
}

export default async function PairingChatRoomPage(props: Props) {
  const params = await props.params;

  if (!isUuidString(params.id)) {
    notFound();
  }
  const { supabase: supabaseConfig } = config;

  const supabase = await createClient();
  const user = await supabase.auth.getUser();
  if (!user.data.user?.id) {
    return null;
  }

  const t = await getTranslations("pairing.chatPage");

  return (
    <main className="container mx-auto p-4">
      <h1 className="text-2xl font-bold mb-6">{t("title")}</h1>

      <ChatRoom
        type="pairing"
        roomId={params.id}
        supabaseUrl={supabaseConfig.url!}
        supabaseKey={supabaseConfig.key!}
      />
    </main>
  );
}
