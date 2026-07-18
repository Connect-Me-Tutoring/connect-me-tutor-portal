import type { PairingLogSchemaType } from "./types";

export type PairingDisplayLogProfile = {
  firstName: string;
  lastName: string;
  role: "student" | "tutor";
};

export type PairingDisplayLog = {
  id: string;
  type:
    | "pairing-match"
    | "pairing-match-rejected"
    | "pairing-match-accepted"
    | "pairing-selection-failed";
  profile: PairingDisplayLogProfile | null;
  message: string;
  status: string;
  created_at?: string;
};

type RpcProfile = {
  first_name?: string | null;
  last_name?: string | null;
  firstName?: string | null;
  lastName?: string | null;
  role?: string | null;
};

function splitDisplayName(fullName: string): {
  firstName: string;
  lastName: string;
} {
  const parts = fullName.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return { firstName: "Unknown", lastName: "" };
  if (parts.length === 1) return { firstName: parts[0], lastName: "" };
  return { firstName: parts[0], lastName: parts.slice(1).join(" ") };
}

function normalizeRole(
  role: string | undefined | null,
): "student" | "tutor" | null {
  const r = role?.trim().toLowerCase();
  if (r === "student") return "student";
  if (r === "tutor") return "tutor";
  return null;
}

function profileFromRpcJson(
  profile: RpcProfile | null | undefined,
): PairingDisplayLogProfile | null {
  if (!profile) return null;
  const role = normalizeRole(profile.role);
  if (!role) return null;
  const firstName =
    profile.firstName ?? profile.first_name ?? "";
  const lastName =
    profile.lastName ?? profile.last_name ?? "";
  if (!firstName && !lastName) return null;
  return {
    firstName: firstName || "Unknown",
    lastName,
    role,
  };
}

function profileFromPreviewLog(
  log: PairingLogSchemaType,
): PairingDisplayLogProfile | null {
  const meta = log.metadata as Record<string, unknown> | undefined;
  const role =
    normalizeRole(log.role) ??
    normalizeRole(meta?.requestor_role as string | undefined);
  if (!role) {
    if (log.type === "pairing-match" && log.message.startsWith("Tutor ")) {
      const tutorRole = "tutor" as const;
      const m = log.message.match(
        /^Tutor\s+(.+?)\s+matched with\s+(.+)$/i,
      );
      if (m) {
        const { firstName, lastName } = splitDisplayName(m[1]);
        return { firstName, lastName, role: tutorRole };
      }
    }
    if (log.type === "pairing-match") {
      const studentRole = "student" as const;
      const m = log.message.match(/^(.+?)\s+matched with\s+(.+)$/i);
      if (m) {
        const { firstName, lastName } = splitDisplayName(m[1]);
        return { firstName, lastName, role: studentRole };
      }
    }
    return null;
  }

  const requestorName =
    typeof meta?.requestor_name === "string" ? meta.requestor_name : "";
  if (requestorName) {
    const { firstName, lastName } = splitDisplayName(requestorName);
    return { firstName, lastName, role };
  }

  if (log.type === "pairing-match" && role === "student") {
    const m = log.message.match(/^(.+?)\s+matched with\s+(.+)$/i);
    if (m) {
      const { firstName, lastName } = splitDisplayName(m[1]);
      return { firstName, lastName, role };
    }
  }

  if (log.type === "pairing-match" && role === "tutor") {
    const m = log.message.match(/^Tutor\s+(.+?)\s+matched with\s+(.+)$/i);
    if (m) {
      const { firstName, lastName } = splitDisplayName(m[1]);
      return { firstName, lastName, role };
    }
  }

  return { firstName: "Unknown", lastName: "", role };
}

export function mapRpcPairingLog(
  log: {
    id: string;
    type: string;
    profile?: RpcProfile | null;
    message: string;
    status: string;
    created_at?: string;
  },
): PairingDisplayLog {
  return {
    id: log.id,
    type: log.type as PairingDisplayLog["type"],
    profile: profileFromRpcJson(log.profile),
    message: log.message,
    status: log.status,
    created_at: log.created_at,
  };
}

export function mapPreviewPairingLog(
  log: PairingLogSchemaType,
  id: string,
  createdAt: string,
): PairingDisplayLog {
  const metadataTimestamp =
    typeof log.metadata?.timestamp === "string"
      ? log.metadata.timestamp
      : undefined;
  return {
    id,
    type: (log.type as PairingDisplayLog["type"]) ?? "pairing-selection-failed",
    profile: profileFromPreviewLog(log),
    message: log.message,
    status: log.error ? "error" : "ok",
    created_at: metadataTimestamp ?? createdAt,
  };
}

export function pairingLogMatchesUserType(
  log: Pick<PairingDisplayLog, "profile"> & { role?: string | null },
  filterUserType: string,
): boolean {
  if (filterUserType === "all") return true;
  const role =
    normalizeRole(log.profile?.role) ?? normalizeRole(log.role);
  return role === filterUserType;
}
