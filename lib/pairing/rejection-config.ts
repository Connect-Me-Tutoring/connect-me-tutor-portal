/** Cooldown for re-matching after a tutor declines (pairing_matches). */
export type PairingRejectionCooldown = number | "never";

/**
 * Reads PAIRING_REJECTION_COOLDOWN_DAYS:
 * - "never" or "-1" → permanent block for same pair (when enforced in RPC/app).
 * - positive integer → days to block after rejection.
 * - default 30 if unset or invalid.
 */
export function getPairingRejectionCooldown(): PairingRejectionCooldown {
  const raw = process.env.PAIRING_REJECTION_COOLDOWN_DAYS?.trim()?.toLowerCase();
  if (raw === "never" || raw === "-1") return "never";
  const n = parseInt(raw ?? "30", 10);
  if (!Number.isFinite(n) || n < 0) return 30;
  return n;
}
