import { useRouter } from "next/navigation";
import { Button } from "../ui/button";
import axios from "axios";
import toast from "react-hot-toast";
import {
  deleteAllPairingRequests,
  resetPairingQueues,
} from "@/lib/actions/pairing.server.actions";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "../ui/alert-dialog";
import { AlertDialogCancel } from "@radix-ui/react-alert-dialog";

export function TestingPairingControls() {
  const router = useRouter();
  const handleResolveQueues = () => {
    const promise = axios.post("/api/pairing");
    toast.promise(promise, {
      success: "Successfully ran pairing process",
      error: "Failed to run pairing process",
      loading: "Pairing...",
    });
  };

  const handleClearQueues = () => {
    toast.promise(resetPairingQueues(), {
      success: "Successfully Reset Queue",
      error: "Failed to Reset Queue",
      loading: "Resetting Queue",
    });
  };

  const handleResetPairings = () => {
    toast.promise(deleteAllPairingRequests(), {
      success: "Successfully Cleared Queue",
      error: "Failed to clear queue",
      loading: "Clearing...",
    });
  };

  return (
    <div className="p-4 border border-dashed border-gray-300 rounded-lg bg-gray-50">
      <h3 className="text-sm font-medium text-gray-700 mb-3">
        Testing Controls
      </h3>
      <div className="flex flex-wrap gap-2">
        <Button onClick={handleResolveQueues} variant="outline" size="sm">
          {" Resolve Queue"}
        </Button>
        <Button onClick={handleClearQueues} variant="outline" size="sm">
          {" Clear Queue"}
        </Button>
        <Button
          onClick={() => router.push("/dashboard/pairing-que/logs")}
          variant="outline"
          size="sm"
        >
          Logs
        </Button>

        {/* <Button onClick={handleResetPairings} variant="destructive" size="sm">
          Reset all pairing matches
        </Button> */}

        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button variant="destructive" size="sm">
              Reset all pairing matches
            </Button>
          </AlertDialogTrigger>

          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Reset All Pairing Matches</AlertDialogTitle>
              <AlertDialogDescription>
                Remove tutors and students from pairing queue
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel asChild>
                <Button variant="outline">Back</Button>
              </AlertDialogCancel>
              <AlertDialogAction onClick={handleResetPairings}>
                Reset all pairing matches
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </div>
  );
}
