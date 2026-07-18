interface TutorReassignmentEmailProps {
  studentName?: string;
  parentName?: string;
  gender?: "male" | "female" | "other";
  subjects?: string[];
  sessionDay?: string;
  sessionTime?: string;
  firstSessionDate?: string;
  zoomLink?: string;
  tutorName?: string;
  tutorEmail?: string;
}

export default function TutorReassignmentEmail({
  studentName = "Sarah Johnson",
  parentName = "Jennifer Johnson",
  gender = "female",
  subjects = [
    "Math",
    "Science",
    "Social Studies",
    "English/Reading/Writing",
    "Time Management/Organization",
    "Navigating Online Learning Platforms",
  ],
  sessionDay = "Saturdays",
  sessionTime = "12-1 pm EST",
  firstSessionDate = "Saturday, April 4th",
  zoomLink = "https://zoom.us/j/1234567890",
  tutorName = "Ms. Emily Rodriguez",
  tutorEmail = "emily.rodriguez@connectme.com",
}: TutorReassignmentEmailProps) {
  // Get pronouns based on gender
  const getPronoun = (type: "subject" | "object" | "possessive") => {
    switch (gender) {
      case "male":
        return type === "subject" ? "he" : type === "object" ? "him" : "his";
      case "female":
        return type === "subject" ? "she" : type === "object" ? "her" : "her";
      default:
        return type === "subject" ? "they" : type === "object" ? "them" : "their";
    }
  };

  const objectPronoun = getPronoun("object");
  const possessivePronoun = getPronoun("possessive");

  return (
    <div className="max-w-2xl mx-auto bg-white font-sans">
      {/* Email Subject Preview */}
      <div className="bg-gray-100 p-4 rounded-t-lg border-b">
        <p className="text-sm text-gray-600 mb-1">Subject:</p>
        <p className="font-semibold text-gray-900">
          {studentName}
          {"'s"} New Tutoring Sessions [PLEASE REPLY]
        </p>
      </div>

      {/* Email Body */}
      <div className="p-6">
        <p className="mb-4 text-gray-900">Hi {parentName},</p>

        <p className="mb-4 text-gray-900 leading-relaxed">
          Thanks for continuing your support of {studentName}
          {"'s"} learning through Connect Me Tutoring! We have matched {objectPronoun} with a new
          tutor for the subjects requested: <strong>{subjects.join(", ")}</strong>, for one session
          per week.
          {" We've"} rescheduled {objectPronoun} for{" "}
          <strong>
            {sessionDay} from {sessionTime}
          </strong>
          . We have included a new Zoom link below, which will be reusable each week.
        </p>

        {/* Highlighted Section */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 my-6">
          <p className="text-blue-800 font-semibold text-center">
            {studentName}
            {"'s"} first session with {possessivePronoun} new tutor will be on {firstSessionDate}{" "}
            from {sessionTime}.
          </p>
        </div>

        <p className="mb-4 text-gray-900 leading-relaxed">
          Be sure to set an alarm on your phone so you {"don't"} accidentally miss your first
          tutoring class.
        </p>

        <p className="mb-4 text-gray-900 leading-relaxed">
          <strong>
            Please reply and confirm with us whether these revised dates/times work for your family.
          </strong>{" "}
          The new tutor should contact you a couple of days before the session, and I have included
          their contact information below.
        </p>

        <p className="mb-6 text-gray-900 leading-relaxed">
          {"We're"} grateful to have {studentName} continue learning with us and remain a part of
          the Connect Me community!
        </p>

        {/* Session Details */}
        <div className="bg-gray-50 rounded-lg p-5 mb-6">
          <h3 className="text-lg font-semibold text-gray-800 mb-3">New Session Details:</h3>
          <div className="space-y-2">
            <p className="text-gray-900">
              <strong>Zoom Link:</strong>{" "}
              <a href={zoomLink} className="text-blue-600 underline hover:text-blue-800">
                {zoomLink}
              </a>
            </p>
            <p className="text-gray-900">
              <strong>{"Tutor's Name:"}</strong> {tutorName}
            </p>
            <p className="text-gray-900">
              <strong>Email:</strong>{" "}
              <a
                href={`mailto:${tutorEmail}`}
                className="text-blue-600 underline hover:text-blue-800"
              >
                {tutorEmail}
              </a>
            </p>
          </div>
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
