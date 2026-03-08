import { SharedPairing } from "@/types/pairing";
import { supabase } from "@/lib/supabase/client";
import { useEffect, useState } from "react";

export const usePairing = (pairingId: string) => {
  const [pairing, setPairing] = useState<SharedPairing>();
  useEffect(() => {
    (async () => {
      console.log("Getting Pairing");
      const { data, error } = await supabase
        .rpc("get_pairing_with_profiles", {
          pairing_uuid: pairingId,
        })
        .single();

      if (data) {
        setPairing(data as SharedPairing);
      }
    })();
  }, [pairingId]);
  return { pairing };
};
