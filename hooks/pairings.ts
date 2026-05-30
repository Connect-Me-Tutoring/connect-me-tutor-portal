import { SharedPairing } from "@/types/pairing";
import { supabase } from "@/lib/supabase/client";
import { isUuidString } from "@/lib/utils";
import { useEffect, useState } from "react";

export const usePairing = (pairingId: string) => {
  const [pairing, setPairing] = useState<SharedPairing>();
  useEffect(() => {
    if (!isUuidString(pairingId)) {
      setPairing(undefined);
      return;
    }
    (async () => {
      const { data, error } = await supabase
        .rpc("get_pairing_with_profiles", {
          pairing_uuid: pairingId,
        })
        .single();

      if (error) {
        console.error("get_pairing_with_profiles", error);
        setPairing(undefined);
        return;
      }
      if (data) {
        setPairing(data as SharedPairing);
      }
    })();
  }, [pairingId]);
  return { pairing };
};
