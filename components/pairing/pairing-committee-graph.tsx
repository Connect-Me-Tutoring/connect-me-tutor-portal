"use client";

import {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
  type MouseEvent,
} from "react";
import { useTranslations } from "next-intl";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import type { PairingMatchPreview, PairingOverlapSlot, PairingRequest } from "@/types/pairing";
import { computeOverlappingAvailabilitySlots, intersectSubjects } from "@/lib/pairing/overlap";
import { to12Hour } from "@/lib/utils";

type GraphNode = {
  id: string;
  label: string;
  role: "student" | "tutor";
  priority?: number;
};

type GraphEdgeDetail = {
  from: string;
  to: string;
  strength: number;
  similarity?: number;
  subjects: string[];
  slots: PairingOverlapSlot[];
  studentName: string;
  tutorName: string;
};

const NODE_W = 172;
const NODE_H = 40;
const PAD = 28;
const GAP_Y = 10;
const CANVAS_W = 840;

function truncate(s: string, max = 24): string {
  const t = s.trim();
  if (t.length <= max) return t;
  return `${t.slice(0, max - 1)}…`;
}

function buildQueueEdges(requests: PairingRequest[]): GraphEdgeDetail[] {
  const students = requests.filter((r) => r.type === "student");
  const tutors = requests.filter((r) => r.type === "tutor");
  const edges: GraphEdgeDetail[] = [];
  for (const s of students) {
    for (const t of tutors) {
      const subjects = intersectSubjects(
        s.profile.subjects_of_interest,
        t.profile.subjects_of_interest,
      );
      const slots = computeOverlappingAvailabilitySlots(
        s.profile.availability,
        t.profile.availability,
      );
      if (subjects.length === 0 && slots.length === 0) continue;
      const strength = Math.min(1, 0.28 + subjects.length * 0.1 + slots.length * 0.07);
      edges.push({
        from: s.userId,
        to: t.userId,
        strength,
        subjects,
        slots,
        studentName: truncate(`${s.profile.firstName} ${s.profile.lastName}`, 40),
        tutorName: truncate(`${t.profile.firstName} ${t.profile.lastName}`, 40),
      });
    }
  }
  return edges;
}

function buildPreviewEdges(previews: PairingMatchPreview[]): GraphEdgeDetail[] {
  return previews.map((p) => ({
    from: p.student_id,
    to: p.tutor_id,
    strength: Math.min(1, (Number(p.similarity) || 0) / 100 + 0.35),
    similarity: typeof p.similarity === "number" ? p.similarity : undefined,
    subjects: p.overlapping_subjects ?? [],
    slots: p.overlapping_slots ?? [],
    studentName: truncate(p.student_name, 40),
    tutorName: truncate(p.tutor_name, 40),
  }));
}

function layoutColumns(
  students: GraphNode[],
  tutors: GraphNode[],
): Map<string, { x: number; y: number }> {
  const pos = new Map<string, { x: number; y: number }>();
  const colLeft = PAD + NODE_W / 2;
  const colRight = CANVAS_W - PAD - NODE_W / 2;
  const y0 = PAD + NODE_H / 2;
  students.forEach((n, i) => {
    pos.set(n.id, { x: colLeft, y: y0 + i * (NODE_H + GAP_Y) });
  });
  tutors.forEach((n, i) => {
    pos.set(n.id, { x: colRight, y: y0 + i * (NODE_H + GAP_Y) });
  });
  return pos;
}

function nodesFromQueue(requests: PairingRequest[]): GraphNode[] {
  return requests.map((r) => ({
    id: r.userId,
    label: truncate(`${r.profile.firstName} ${r.profile.lastName}`),
    role: r.type,
    priority: r.priority,
  }));
}

function nodesFromPreview(previews: PairingMatchPreview[]): GraphNode[] {
  const byId = new Map<string, GraphNode>();
  for (const p of previews) {
    if (!byId.has(p.student_id)) {
      byId.set(p.student_id, {
        id: p.student_id,
        label: truncate(p.student_name),
        role: "student",
      });
    }
    if (!byId.has(p.tutor_id)) {
      byId.set(p.tutor_id, {
        id: p.tutor_id,
        label: truncate(p.tutor_name),
        role: "tutor",
      });
    }
  }
  return [...byId.values()];
}

function formatSlot(slot: PairingOverlapSlot): string {
  return `${slot.day}: ${to12Hour(slot.startTime)} – ${to12Hour(slot.endTime)}`;
}

export type PairingCommitteeGraphDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode: "queue" | "preview";
  requests?: PairingRequest[];
  previews?: PairingMatchPreview[];
  /** Replaces the default "Pairing committee graph" title */
  title?: string;
  /** Replaces the default mode-specific description under the title */
  description?: string;
};

export function PairingCommitteeGraphDialog({
  open,
  onOpenChange,
  mode,
  requests = [],
  previews = [],
  title,
  description,
}: PairingCommitteeGraphDialogProps) {
  const t = useTranslations("pairing.committeeGraph");
  const markerId = useId().replace(/:/g, "");
  const [focusedNodeId, setFocusedNodeId] = useState<string | null>(null);
  const [edgeTip, setEdgeTip] = useState<{
    clientX: number;
    clientY: number;
    edge: GraphEdgeDetail;
  } | null>(null);
  const tipRef = useRef<HTMLDivElement>(null);

  const graph = useMemo(() => {
    if (mode === "preview") {
      const edges = buildPreviewEdges(previews);
      const nodes = nodesFromPreview(previews);
      const students = nodes.filter((n) => n.role === "student");
      const tutors = nodes.filter((n) => n.role === "tutor");
      students.sort((a, b) => a.label.localeCompare(b.label));
      tutors.sort((a, b) => a.label.localeCompare(b.label));
      const canvasH = PAD * 2 + Math.max(students.length, tutors.length, 1) * (NODE_H + GAP_Y);
      return {
        edges,
        nodes,
        students,
        tutors,
        canvasH,
        subtitle: t("subtitlePreview"),
      };
    }

    const edges = buildQueueEdges(requests);
    const nodes = nodesFromQueue(requests);
    const students = nodes.filter((n) => n.role === "student");
    const tutors = nodes.filter((n) => n.role === "tutor");
    students.sort(
      (a, b) => (a.priority ?? 0) - (b.priority ?? 0) || a.label.localeCompare(b.label),
    );
    tutors.sort((a, b) => (a.priority ?? 0) - (b.priority ?? 0) || a.label.localeCompare(b.label));
    const canvasH = PAD * 2 + Math.max(students.length, tutors.length, 1) * (NODE_H + GAP_Y);
    return {
      edges,
      nodes,
      students,
      tutors,
      canvasH,
      subtitle: t("subtitleQueue"),
    };
  }, [mode, requests, previews, t]);

  const { edges, nodes, students, tutors, canvasH, subtitle } = graph;
  const dialogTitle = title ?? t("defaultTitle");
  const dialogDescription = description ?? subtitle;

  const positions = useMemo(() => layoutColumns(students, tutors), [students, tutors]);

  const focusedLabel = useMemo(() => {
    if (!focusedNodeId) return null;
    return nodes.find((n) => n.id === focusedNodeId)?.label ?? focusedNodeId;
  }, [focusedNodeId, nodes]);

  const filteredEdges = useMemo(() => {
    if (!focusedNodeId) return edges;
    return edges.filter((e) => e.from === focusedNodeId || e.to === focusedNodeId);
  }, [edges, focusedNodeId]);

  const edgePaths = useMemo(() => {
    return filteredEdges
      .map((edge, idx) => {
        const a = positions.get(edge.from);
        const b = positions.get(edge.to);
        if (!a || !b) return null;
        const x1 = a.x + NODE_W / 2;
        const y1 = a.y;
        const x2 = b.x - NODE_W / 2;
        const y2 = b.y;
        const mid = (x1 + x2) / 2;
        const lift = (idx % 7) * 5 - 15;
        const d = `M ${x1} ${y1} Q ${mid} ${y1 + lift} ${x2} ${y2}`;
        return { d, edge, key: `${edge.from}-${edge.to}-${idx}` };
      })
      .filter(Boolean) as { d: string; edge: GraphEdgeDetail; key: string }[];
  }, [filteredEdges, positions]);

  const clearFocus = useCallback(() => {
    setFocusedNodeId(null);
    setEdgeTip(null);
  }, []);

  const graphDataKey = useMemo(() => {
    if (mode === "preview") {
      return previews
        .map((p) => `${p.student_id}>${p.tutor_id}`)
        .sort()
        .join(";");
    }
    return requests
      .map((r) => `${r.userId}:${r.type}`)
      .sort()
      .join(";");
  }, [mode, previews, requests]);

  useEffect(() => {
    if (!open) {
      setFocusedNodeId(null);
      setEdgeTip(null);
    }
  }, [open]);

  useEffect(() => {
    setFocusedNodeId(null);
    setEdgeTip(null);
  }, [graphDataKey]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setEdgeTip(null);
        setFocusedNodeId(null);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  useEffect(() => {
    if (!edgeTip) return;
    const onDown = (e: globalThis.MouseEvent) => {
      if (tipRef.current?.contains(e.target as Node)) return;
      setEdgeTip(null);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [edgeTip]);

  const empty = mode === "queue" ? requests.length === 0 : previews.length === 0;

  const onNodeClick = (e: MouseEvent, id: string) => {
    e.stopPropagation();
    setEdgeTip(null);
    setFocusedNodeId((prev) => (prev === id ? null : id));
  };

  const onEdgeClick = (e: MouseEvent, edge: GraphEdgeDetail) => {
    e.stopPropagation();
    setEdgeTip({
      clientX: e.clientX,
      clientY: e.clientY,
      edge,
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[920px] max-h-[92vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>{dialogTitle}</DialogTitle>
          <DialogDescription>{dialogDescription}</DialogDescription>
        </DialogHeader>
        <div className="flex flex-wrap items-center gap-2 shrink-0 pb-2">
          {focusedNodeId && focusedLabel && (
            <>
              <span className="text-sm text-muted-foreground">{t("showingLinksFor")}</span>
              <Badge variant="secondary" className="font-medium">
                {focusedLabel}
              </Badge>
              <Button type="button" variant="outline" size="sm" onClick={clearFocus}>
                {t("clearFocus")}
              </Button>
            </>
          )}
        </div>
        <div className="flex-1 min-h-0 overflow-auto rounded-md border bg-muted/20 p-2 relative">
          {empty ? (
            <p className="text-sm text-muted-foreground p-4">{t("nothingToGraph")}</p>
          ) : (
            <>
              {edges.length === 0 && mode === "queue" && (
                <p className="text-sm text-amber-900 bg-amber-50 border border-amber-200 rounded-md p-2 mb-2">
                  {t("noOverlapWarning")}
                </p>
              )}
              <svg
                width="100%"
                viewBox={`0 0 ${CANVAS_W} ${canvasH}`}
                className="min-w-[640px] h-auto block"
                role="img"
                aria-label={t("graphAriaLabel")}
              >
                <defs>
                  <marker
                    id={`pairing-arrow-${markerId}`}
                    markerWidth="9"
                    markerHeight="9"
                    refX="8"
                    refY="4.5"
                    orient="auto"
                  >
                    <path d="M0,0 L9,4.5 L0,9 Z" fill="#64748b" />
                  </marker>
                  <marker
                    id={`pairing-arrow-focus-${markerId}`}
                    markerWidth="9"
                    markerHeight="9"
                    refX="8"
                    refY="4.5"
                    orient="auto"
                  >
                    <path d="M0,0 L9,4.5 L0,9 Z" fill="#2563eb" />
                  </marker>
                </defs>

                {edgePaths.map(({ d, edge, key }) => {
                  const isFocus = Boolean(focusedNodeId);
                  const stroke = isFocus ? "#2563eb" : "#94a3b8";
                  const marker = isFocus
                    ? `url(#pairing-arrow-focus-${markerId})`
                    : `url(#pairing-arrow-${markerId})`;
                  return (
                    <path
                      key={key}
                      d={d}
                      fill="none"
                      stroke={stroke}
                      strokeWidth={1 + edge.strength * 1.8}
                      strokeOpacity={isFocus ? 0.75 : 0.4 + edge.strength * 0.45}
                      markerEnd={marker}
                    />
                  );
                })}

                {nodes.map((n) => {
                  const p = positions.get(n.id);
                  if (!p) return null;
                  const isStudent = n.role === "student";
                  const x = p.x - NODE_W / 2;
                  const y = p.y - NODE_H / 2;
                  const isFocused = focusedNodeId === n.id;
                  const dimmed =
                    focusedNodeId != null &&
                    n.id !== focusedNodeId &&
                    !edges.some(
                      (e) =>
                        (e.from === focusedNodeId && e.to === n.id) ||
                        (e.from === n.id && e.to === focusedNodeId),
                    );
                  const fill = isStudent ? "#eff6ff" : "#ecfdf5";
                  const stroke = isFocused ? "#2563eb" : isStudent ? "#60a5fa" : "#34d399";
                  const roleLabel = isStudent ? t("roleStudent") : t("roleTutor");
                  const sub =
                    n.priority != null
                      ? t("roleWithPriority", { role: roleLabel, priority: n.priority })
                      : roleLabel;
                  return (
                    <g
                      key={n.id}
                      role="button"
                      tabIndex={0}
                      style={{ cursor: "pointer" }}
                      onClick={(e) => onNodeClick(e, n.id)}
                      onKeyDown={(e: ReactKeyboardEvent) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          setEdgeTip(null);
                          setFocusedNodeId((prev) => (prev === n.id ? null : n.id));
                        }
                      }}
                      opacity={dimmed ? 0.35 : 1}
                    >
                      <rect
                        x={x}
                        y={y}
                        width={NODE_W}
                        height={NODE_H}
                        rx={6}
                        fill={fill}
                        stroke={stroke}
                        strokeWidth={isFocused ? 3 : 2}
                      />
                      <text
                        x={p.x}
                        y={y + 17}
                        textAnchor="middle"
                        fill="#0f172a"
                        fontSize={11}
                        fontWeight={600}
                        fontFamily="system-ui, sans-serif"
                      >
                        {n.label}
                      </text>
                      <text
                        x={p.x}
                        y={y + 32}
                        textAnchor="middle"
                        fill="#64748b"
                        fontSize={9}
                        fontFamily="system-ui, sans-serif"
                      >
                        {sub}
                      </text>
                    </g>
                  );
                })}

                {edgePaths.map(({ d, edge, key }) => (
                  <path
                    key={`hit-${key}`}
                    d={d}
                    fill="none"
                    stroke="transparent"
                    strokeWidth={18}
                    pointerEvents="stroke"
                    style={{ cursor: "pointer" }}
                    onClick={(e) => onEdgeClick(e, edge)}
                  />
                ))}
              </svg>

              {edgeTip && (
                <div
                  ref={tipRef}
                  role="dialog"
                  aria-label={t("overlapDetailsAriaLabel")}
                  className="fixed z-[200] w-[min(22rem,calc(100vw-2rem))] max-h-[min(70vh,24rem)] overflow-y-auto rounded-md border bg-popover p-3 text-popover-foreground shadow-lg"
                  style={(() => {
                    const pad = 8;
                    const panelW = Math.min(352, window.innerWidth - 2 * pad);
                    const panelH = 280;
                    const left = Math.max(
                      pad,
                      Math.min(edgeTip.clientX + pad, window.innerWidth - panelW - pad),
                    );
                    const top = Math.max(
                      pad,
                      Math.min(edgeTip.clientY + pad, window.innerHeight - panelH - pad),
                    );
                    return { left, top };
                  })()}
                >
                  <div className="text-sm font-semibold border-b pb-2 mb-2">
                    {edgeTip.edge.studentName}{" "}
                    <span className="text-muted-foreground font-normal">→</span>{" "}
                    {edgeTip.edge.tutorName}
                  </div>
                  {edgeTip.edge.similarity != null && (
                    <p className="text-xs text-muted-foreground mb-2">
                      {t("similarityScore", { score: edgeTip.edge.similarity })}
                    </p>
                  )}
                  <div className="space-y-2">
                    <div>
                      <p className="text-xs font-medium text-muted-foreground mb-1">
                        {t("overlappingSubjects")}
                      </p>
                      {edgeTip.edge.subjects.length === 0 ? (
                        <p className="text-xs text-muted-foreground">{t("noneListed")}</p>
                      ) : (
                        <div className="flex flex-wrap gap-1">
                          {edgeTip.edge.subjects.map((s) => (
                            <Badge key={s} variant="secondary" className="text-xs">
                              {s}
                            </Badge>
                          ))}
                        </div>
                      )}
                    </div>
                    <div>
                      <p className="text-xs font-medium text-muted-foreground mb-1">
                        {t("overlappingTimes")}
                      </p>
                      {edgeTip.edge.slots.length === 0 ? (
                        <p className="text-xs text-muted-foreground">{t("noneListed")}</p>
                      ) : (
                        <ul className="text-xs space-y-1 list-disc pl-4">
                          {edgeTip.edge.slots.map((slot, i) => (
                            <li key={`${slot.day}-${slot.startTime}-${i}`}>{formatSlot(slot)}</li>
                          ))}
                        </ul>
                      )}
                    </div>
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="mt-3 w-full"
                    onClick={() => setEdgeTip(null)}
                  >
                    {t("close")}
                  </Button>
                </div>
              )}
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
