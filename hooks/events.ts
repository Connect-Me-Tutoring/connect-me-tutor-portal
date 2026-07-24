import { getEvents } from "@/lib/actions/event.client.actions";
import { useQuery } from "@tanstack/react-query";

export const useEvents = (tutorId: string, orderBy?: { field: string; ascending: boolean }) => {
  return useQuery({
    queryKey: ["events", tutorId, orderBy],
    queryFn: () => {
      return getEvents(tutorId, orderBy);
    },
    enabled: !!tutorId,
  });
};

// export const useEvents = async (
//   params: any,
//   func: any
// ) => {
//     return useQuery({
//         queryKey: [params],
//         queryFn: async () => {
//             return await getEvents(tutorId, orderBy)
//         },
//         enabled: !!tutorId
//     })
// };
