import React, { useState, useEffect } from "react";
import { Profile } from "@/types";
import { getProfileByEmail } from "@/lib/actions/user/client.actions";

const StudentProfileDashboard = () => {
  const [studentProfiles, setStudentProfiles] = useState<Profile[]>([]);

  useEffect(() => {
    // const studentProfiles = getProfileByEmail()
  }, []);

  return <></>;
};

export default StudentProfileDashboard;
