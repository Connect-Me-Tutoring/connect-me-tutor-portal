import { SharedEnrollment } from "@/types/enrollment";
import { supabase } from "@/lib/supabase/client";
import { useEffect, useState } from "react";

export const useEnrollment = (enrollmentId: string) => {
  const [enrollment, setEnrollment] = useState<SharedEnrollment>();
  useEffect(() => {
    (async () => {
      const { data, error } = await supabase
        .rpc("get_enrollment_with_profiles", {
          enrollment_uuid: enrollmentId,
        })
        .single();

      if (data) {
        setEnrollment(data as SharedEnrollment);
      }

    })();
  }, [enrollmentId]);
  return { enrollment };
};
