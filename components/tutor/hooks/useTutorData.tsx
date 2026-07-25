// import { useState, useEffect } from "react";
// import { createClientComponentClient } from "@supabase/auth-helpers-nextjs";
// import { getProfile } from "@/lib/actions/user/actions";
// import { getTutorSessions } from "@/lib/actions/tutor/tutor.actions";
// import { Profile, Session } from "@/types";
// import toast from "react-hot-toast";
// import { endOfWeek } from "date-fns";

// export const useTutorData = () => {
//   const supabase = createClientComponentClient();
//   const [sessions, setSessions] = useState<Session[]>([]);
//   const [filteredSessions, setFilteredSessions] = useState<Session[]>([]);
//   const [profile, setProfile] = useState<Profile | null>(null);
//   const [loading, setLoading] = useState(true);
//   const [error, setError] = useState<string | null>(null);
//   const [filterValue, setFilterValue] = useState("");

//   const getUserData = async () => {
//     try {
//       setLoading(true);
//       setError(null);

//       const {
//         data: { user },
//         error: userError,
//       } = await supabase.auth.getUser();

//       if (userError) throw new Error(userError.message);
//       if (!user) throw new Error("No user found");

//       const profileData = await getProfile(user.id);
//       if (!profileData) throw new Error("No profile found");

//       setProfile(profileData);

//       const endWeek = endOfWeek(new Date()).toISOString();

//       const sessionsData = await getTutorSessions(
//         profileData.id,
//         undefined,
//         undefined
//       );

//       if (!sessionsData) throw new Error("No sessions found");

//       setSessions(sessionsData);
//       setFilteredSessions(sessionsData);
//     } catch (error) {
//       console.error("Error fetching user data:", error);
//       setError(
//         error instanceof Error ? error.message : "An unknown error occurred"
//       );
//       toast.error("Failed to load data");
//     } finally {
//       setLoading(false);
//     }
//   };

//   useEffect(() => {
//     getUserData();
//   }, [supabase.auth]);

//   useEffect(() => {
//     const filtered = sessions.filter(
//       (session) =>
//         session.student?.firstName
//           .toLowerCase()
//           .includes(filterValue.toLowerCase()) ||
//         session.student?.lastName
//           .toLowerCase()
//           .includes(filterValue.toLowerCase())
//     );

//     setFilteredSessions(filtered);
//   }, [filterValue, sessions]);

//   return {
//     sessions,
//     setSessions,
//     filteredSessions,
//     setFilteredSessions,
//     profile,
//     loading,
//     error,
//     filterValue,
//     setFilterValue,
//     refreshData: getUserData,
//   };
// };
