import { useEffect, useState } from "react";
import toast from "react-hot-toast";

import { Button } from "@/components/ui/button";
import {
  countLegacyPendingParentalConsents,
  provisionLegacyPendingParentalConsents,
} from "@/lib/actions/auth/server.actions";

/**
 * Shown while students are still waiting on the retired parent-approval email link.
 * Hides itself once there are none, so it can be deleted after they're cleared.
 */
const LegacyConsentBanner = () => {
  const [pendingCount, setPendingCount] = useState(0);
  const [working, setWorking] = useState(false);

  useEffect(() => {
    countLegacyPendingParentalConsents()
      .then(setPendingCount)
      .catch(() => setPendingCount(0));
  }, []);

  if (pendingCount === 0) return null;

  const handleCreate = async () => {
    setWorking(true);
    try {
      const { provisioned, failed } = await provisionLegacyPendingParentalConsents();
      setPendingCount(failed);
      if (failed > 0) {
        toast.error(`Created ${provisioned} accounts; ${failed} failed. Try again.`);
      } else {
        toast.success(`Created ${provisioned} accounts. Refresh to see them in the list.`);
      }
    } catch {
      toast.error("Could not create the accounts. Please try again.");
    } finally {
      setWorking(false);
    }
  };

  return (
    <div className="mb-4 flex flex-col gap-3 rounded-md border border-amber-300 bg-amber-50 p-4 text-sm sm:flex-row sm:items-center sm:justify-between">
      <p>
        {pendingCount} {pendingCount === 1 ? "student is" : "students are"} still waiting on the old
        parent-approval email. Their consent is on file from intake, so their accounts can be
        created now.
      </p>
      <Button disabled={working} onClick={handleCreate} className="shrink-0">
        {working ? "Creating..." : "Create accounts"}
      </Button>
    </div>
  );
};

export default LegacyConsentBanner;
