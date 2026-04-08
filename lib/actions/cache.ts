import { cache } from "react";
import { getProfile, getTutorStudents } from "./profile.server.actions";

export const cachedGetProfile = cache(getProfile);

export const cachedGetTutorStudents = cache(getTutorStudents);
