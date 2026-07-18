interface TutorPairingEmailProps {
  tutorName?: string;
  studentName?: string;
  parentName?: string;
  parentTitle?: "Mr." | "Mrs." | "Ms." | "Dr.";
  sessionDay?: string;
  sessionDate?: string;
  sessionTime?: string;
  zoomLink?: string;
  subjects?: string[];
}

export default function TutorPairingEmail({
  tutorName = "Emily Rodriguez",
  studentName = "Sarah Johnson",
  parentName = "Jennifer Johnson",
  parentTitle = "Mrs.",
  sessionDay = "Monday",
  sessionDate = "April 8th",
  sessionTime = "6 PM - 7 PM EST",
  zoomLink = "https://zoom.us/j/1234567890",
  subjects = ["Math", "Science"],
}: TutorPairingEmailProps) {
  return (
    <div className="max-w-2xl mx-auto bg-white font-sans">
      {/* Email Subject Preview */}
      <div className="bg-gray-100 p-4 rounded-t-lg border-b">
        <p className="text-sm text-gray-600 mb-1">Subject:</p>
        <p className="font-semibold text-gray-900">
          {"You've"} been paired with {studentName} - Action Required
        </p>
      </div>

      {/* Email Body */}
      <div className="p-6">
        <p className="mb-4 text-gray-900">Hi {tutorName},</p>

        {/* Highlighted First Session Info */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 my-6">
          <p className="text-blue-800 font-semibold text-center">
            Your first session with {studentName} will start on {sessionDay}, {sessionDate} from{" "}
            {sessionTime}.
          </p>
        </div>

        <p className="mb-4 text-gray-900 leading-relaxed">
          <strong>
            Please send a tutor introduction to your {"student's"} parents 3-4 days before the
            session.
          </strong>{" "}
          This will let you introduce yourself and have a chance to ask them to send you any
          homework that the student has beforehand. Make sure to remind them the day of the session
          as well!
        </p>

        {/* Template Section */}
        <div className="bg-gray-50 rounded-lg p-5 mb-6">
          <h3 className="text-lg font-semibold text-gray-800 mb-3">Introduction Template:</h3>
          <div className="bg-white border border-gray-200 rounded p-4 text-sm text-gray-900 leading-relaxed">
            <p className="mb-3">
              Hello {parentTitle} {parentName}, my name is {tutorName}, and {"I'm"} your tutor for{" "}
              {studentName}, paired to you through Connect Me tutoring.
            </p>
            <p className="mb-3">
              {studentName} will be meeting with me every {sessionDay} from {sessionTime}. {"I'll"}{" "}
              send the Zoom link below as well, which will stay the same every week.
            </p>
            <p className="mb-3">
              <strong>Zoom Link:</strong>{" "}
              <a href={zoomLink} className="text-blue-600 underline hover:text-blue-800">
                {zoomLink}
              </a>
            </p>
            <p className="mb-3">
              Please be aware that if {studentName} is unable to attend two consecutive sessions
              without prior notification, their tutoring privileges may be reconsidered.
            </p>
            <p>
              {"It's"} nice meeting you, and if you have any questions, please {"don't"} hesitate to
              ask!
            </p>
          </div>
        </div>

        {/* Session Details */}
        <div className="bg-gray-50 rounded-lg p-5 mb-6">
          <h3 className="text-lg font-semibold text-gray-800 mb-3">Session Details:</h3>
          <div className="space-y-2">
            <p className="text-gray-900">
              <strong>Student:</strong> {studentName}
            </p>
            <p className="text-gray-900">
              <strong>Parent:</strong> {parentTitle} {parentName}
            </p>
            <p className="text-gray-900">
              <strong>Subjects:</strong> {subjects.join(", ")}
            </p>
            <p className="text-gray-900">
              <strong>Schedule:</strong> {sessionDay}s from {sessionTime}
            </p>
            <p className="text-gray-900">
              <strong>Zoom Link:</strong>{" "}
              <a href={zoomLink} className="text-blue-600 underline hover:text-blue-800">
                {zoomLink}
              </a>
            </p>
          </div>
        </div>

        {/* Important Resources */}
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-6">
          <h3 className="text-lg font-semibold text-yellow-800 mb-3">Important Resources:</h3>
          <div className="space-y-2">
            <p className="text-yellow-800">
              <strong>Connect Me Tutor Starter Pack:</strong>{" "}
              <a
                href="https://docs.google.com/document/d/1eVQPX2Rjx-b5n93070zHjXSMpzBs0twwGpRPAOYmHec/edit?tab=t.0#heading=h.kk1966kbedef"
                className="text-blue-600 underline hover:text-blue-800"
                target="_blank"
                rel="noopener noreferrer"
              >
                Please read before your first session
              </a>
            </p>
            <p className="text-yellow-800">
              <strong>Tutor Portal:</strong>{" "}
              <a
                href="https://www.connectmego.app/"
                className="text-blue-600 underline hover:text-blue-800"
                target="_blank"
                rel="noopener noreferrer"
              >
                Access zoom link and fill out exit form after EVERY session
              </a>
            </p>
          </div>
        </div>

        <p className="mb-4 text-gray-900 leading-relaxed">
          If you have any concerns about tutoring your student—such as being unable to continue
          sessions, student is inconsistent, or feeling unsafe—please reach out to{" "}
          <strong>Yulianna, Ashritaa, or Claudia</strong>.
        </p>

        {/* Action Required */}
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
          <p className="text-red-800 font-semibold">
            <strong>Action Required:</strong> Please respond to this message acknowledging{" "}
            {"you've"} read it and understand that you have been paired with this student.
          </p>
        </div>

        <div className="mt-8 pt-4 border-t border-gray-200">
          <p className="text-gray-900 leading-relaxed">
            Best,
            <br />
            Connect Me Free Tutoring & Mentoring
          </p>
        </div>
      </div>
    </div>
  );
}
