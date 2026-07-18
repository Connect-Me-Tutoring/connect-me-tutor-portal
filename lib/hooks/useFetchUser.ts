import { useEffect } from "react";
import { createClient } from "../supabase/server";

export const useFetchUser = () => {
  useEffect(() => {
    const fetchUser = async () => {
      try {
        const supabase = await createClient();
      } catch (error) {
        throw Error;
      }
    };
  }, []);
};
