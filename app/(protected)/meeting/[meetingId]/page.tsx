"use client";

import Link from "next/link";
// import { useRouter } from "next/router"; // Not used in the provided code, can be removed if not needed elsewhere
import { useEffect, useState, useRef, use } from "react";
// import axios, { AxiosResponse } from "axios"; // Not used, can be removed
import { createClientComponentClient } from "@supabase/auth-helpers-nextjs";
import { getMeeting } from "@/lib/actions/meeting.actions";
import { Meeting } from "@/types";
import { Button } from "@/components/ui/button";
import { Copy, ExternalLink, Loader2, AlertTriangle } from "lucide-react"; // Added ExternalLink and AlertTriangle
import toast, { Toaster } from "react-hot-toast";

type ParamsProps = {
  params: Promise<{ meetingId: string }>;
};

// interface ZoomResponseData { // This interface is not used, can be removed if not needed for Zoom SDK integration
//   meetingId: string;
//   joinUrl: string;
//   signature: any;
//   sdkKey: any;
// }

const MeetingPage = (props: ParamsProps) => {
  const params = use(props.params);
  const meetingId = params.meetingId;
  // console.log("MEETING ID", meetingId);

  const [meeting, setMeeting] = useState<Meeting | null>(null);
  // const meetingSDKElementRef = useRef<HTMLDivElement>(null); // Not used for Zoom SDK in this version
  const supabase = createClientComponentClient(); // Supabase client initialized but not used directly in this snippet
  const [loading, setLoading] = useState(true); // Start with loading true
  const [error, setError] = useState<string | null>(null); // State for error messages

  useEffect(() => {
    const getThisMeeting = async () => {
      if (!meetingId) {
        setError("Meeting ID is missing.");
        setLoading(false);
        return;
      }
      setLoading(true); // Ensure loading is true when fetching
      setError(null); // Reset error state
      try {
        const meetingData = await getMeeting(meetingId);
        // console.log("THIS MEETING DATA", meetingData);

        if (meetingData) {
          setMeeting(meetingData);
        } else {
          setError("Meeting not found or could not be retrieved.");
          setMeeting(null); // Ensure meeting is null if not found
        }
      } catch (err) {
        console.error("Error fetching meeting:", err);
        setError("Failed to fetch meeting details. Please try again later.");
        setMeeting(null);
      } finally {
        setLoading(false);
      }
    };

    getThisMeeting();
  }, [meetingId]); // Add meetingId as a dependency

  const handleJoinMeeting = () => {
    if (meeting?.link) {
      window.open(meeting.link, "_blank", "noopener,noreferrer");
    }
  };

  const handleCopyLink = () => {
    if (meeting?.link) {
      navigator.clipboard.writeText(meeting.link);
      toast.success("Meeting link copied to clipboard!");
    } else {
      toast.error("No meeting link available to copy.");
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50 p-4 text-center">
        <Loader2 className="h-12 w-12 animate-spin text-blue-600 mb-4" />
        <p className="text-lg font-medium text-gray-700">
          Loading Meeting Details...
        </p>
        <p className="text-sm text-gray-500">Please wait a moment.</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-red-50 p-4 text-center">
        <AlertTriangle className="h-12 w-12 text-red-500 mb-4" />
        <h2 className="text-xl font-semibold text-red-700 mb-2">
          Error Loading Meeting
        </h2>
        <p className="text-red-600 mb-6">{error}</p>
        <Button onClick={() => window.location.reload()}>Try Again</Button>
        <Link href="/dashboard" className="mt-4">
          <Button variant="outline">Go to Dashboard</Button>
        </Link>
      </div>
    );
  }

  if (!meeting) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50 p-4 text-center">
        <AlertTriangle className="h-12 w-12 text-yellow-500 mb-4" />
        <h2 className="text-xl font-semibold text-gray-700 mb-2">
          Meeting Not Found
        </h2>
        <p className="text-gray-600 mb-6">
          The meeting you are looking for could not be found.
        </p>
        <Link href="/dashboard">
          <Button variant="outline">Go to Dashboard</Button>
        </Link>
      </div>
    );
  }

  /*
  useEffect(() => {
    const fetchData = async () => {
      try {
        const zoomEmbed = await (await import('@zoomus/websdk/embedded')).default;
        let client = zoomEmbed.createClient();
        let meetingSDKElement = meetingSDKElementRef.current;

        if (meetingSDKElement) {
          client.init({
            language: 'en-US',
            zoomAppRoot: meetingSDKElement
          });

          let payload = {
            meetingNumber: meeting?.meetingId,
            // Add other payload properties if needed
          };

          const fetchZoomData = async (payload: any): Promise<ZoomResponseData | undefined> => {
            try {
              const response: AxiosResponse<ZoomResponseData> = await axios({
                url: '/api/zoom',
                method: 'post',
                data: payload,
              });
              return response.data;
            } catch (error) {
              console.error('Signature axios request error:', error);
              return undefined;
            }
          };

          const handleZoomMeeting = async (payload: any) => {
            const data = await fetchZoomData(payload);
            if (data) {
              if (meeting) {
                client.join({
                    meetingNumber: payload.meetingNumber,
                    signature: data.signature,
                    sdkKey: data.sdkKey,
                    userName: 'User', // Replace with dynamic user name
                    password: meeting?.password, // Replace with actual password if needed
                    tk: ''
                  });
              }
            } else {
              console.error('Failed to fetch Zoom data');
            }
          };

          handleZoomMeeting(payload);
        } else {
          console.error('Zoom SDK root element is not found.');
        }
      } catch (error) {
        console.error('Error:', error);
      }
    };

    if (meetingId) {
      fetchData();
    }
  }, [meetingId]);
  */

  return (
    <>
      <Toaster position="top-center" />
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-100 to-sky-100 p-4">
        <div className="bg-white shadow-xl rounded-lg p-6 sm:p-8 w-full max-w-lg transform transition-all hover:scale-[1.01] duration-300">
          <div className="text-center mb-6">
            <h1 className="text-2xl sm:text-3xl font-bold text-gray-800">
              {meeting.name || "Meeting Details"}
            </h1>
            <p className="text-sm text-gray-500 mt-1">
              Meeting ID: {meeting.id}
            </p>
          </div>

          {/* Placeholder for Zoom SDK if you re-integrate it */}
          {/* <div id="meetingSDKElement" ref={meetingSDKElementRef} style={{ width: '100%', height: '400px', marginBottom: '1.5rem' }} className="border rounded-md bg-gray-50">
             Zoom SDK will be rendered here
          </div> */}

          {meeting.link ? (
            <div className="space-y-4">
              <Button
                onClick={handleJoinMeeting}
                className="w-full bg-blue-600 hover:bg-blue-700 text-white py-3 text-lg font-semibold flex items-center justify-center gap-2"
                size="lg"
              >
                <ExternalLink className="h-5 w-5" />
                Join Meeting
              </Button>
              <Button
                variant="outline"
                onClick={handleCopyLink}
                className="w-full flex items-center justify-center gap-2 border-gray-300 hover:bg-gray-50"
              >
                <Copy className="h-4 w-4" />
                Copy Meeting Link
              </Button>
            </div>
          ) : (
            <div className="text-center py-8">
              <AlertTriangle className="h-10 w-10 text-orange-400 mx-auto mb-3" />
              <p className="text-gray-600 font-medium">
                No join link available for this meeting.
              </p>
              <p className="text-sm text-gray-500 mt-1">
                Please check back later or contact support.
              </p>
            </div>
          )}

          <div className="mt-8 text-center">
            <Link href="/dashboard">
              <Button
                variant="ghost"
                className="text-sm text-gray-600 hover:text-gray-800"
              >
                &larr; Back to Dashboard
              </Button>
            </Link>
          </div>
        </div>
      </div>
    </>
  );
};

export default MeetingPage;
