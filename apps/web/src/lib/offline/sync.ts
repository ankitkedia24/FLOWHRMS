"use client";

import { checkInAction, checkOutAction } from "@/lib/attendance/actions";
import { requestLeaveAction } from "@/lib/leave/actions";
import { submitProofAction } from "@/lib/tasks/actions";
import { uploadProofFiles } from "@/lib/tasks/upload";
import {
  arriveAction,
  backAtOfficeAction,
  goingOutAction,
  leaveAction,
} from "@/lib/field-visits/actions";
import { uploadMedia } from "@/lib/media/upload";
import {
  classifyOutcome,
  sortQueue,
  summariseSync,
  type QueuedAction,
  type SendOutcome,
  type SyncSummary,
} from "./queue";
import { listActions, putAction, removeAction } from "./store";

/**
 * Sends queued work when the connection returns.
 *
 * Runs one action at a time, oldest first, each carrying its original
 * capture time. A server refusal takes the item out of the retry loop and
 * flags it so the person is told; only transport failures are retried.
 */

export interface CheckInPayload {
  coords: { lat: number; lng: number; accuracyM?: number | null } | null;
  reason?: string;
}

export interface CheckOutPayload {
  coords: { lat: number; lng: number; accuracyM?: number | null } | null;
}

export interface LeavePayload {
  type: "FULL_DAY" | "HALF_DAY" | "EMERGENCY";
  startDate: string;
  endDate: string;
  reason: string;
}

export interface ProofPayload {
  /**
   * The company folder the files upload into. Optional only because proof
   * queued before it was added carries none; that is refused, not guessed.
   */
  tenantId?: string;
  taskId: string;
  note?: string;
  /** Kept as Blobs in IndexedDB so a photo survives the tab closing. */
  files: Array<{ name: string; type: string; blob: Blob }>;
}

/** A field visit tap (FIELD-VISITS-MODULE.md §3), with its photo kept as a Blob. */
export interface FieldTapPayload {
  tap: "GOING_OUT" | "ARRIVE" | "LEAVE" | "BACK";
  coords: { lat: number; lng: number; accuracyM?: number | null } | null;
  arrive?: {
    place:
      | { kind: "saved"; placeId: string }
      | { kind: "new"; name: string; address?: string }
      | { kind: "once"; name: string };
    purposeKey?: string;
    note?: string;
  };
  /** End visit: the note as it stood when the visit ended. */
  note?: string;
  photo?: { tenantId: string; type: string; blob: Blob };
}

/** A transport failure looks like a thrown error, not a returned result. */
function asRetry(error: unknown): SendOutcome {
  const message =
    error instanceof Error ? error.message : "Couldn't reach the server.";
  return { status: "retry", error: message };
}

async function send(action: QueuedAction): Promise<SendOutcome> {
  try {
    switch (action.kind) {
      case "checkIn": {
        const payload = action.payload as CheckInPayload;
        const result = await checkInAction({
          coords: payload.coords,
          reason: payload.reason,
          clientCapturedAt: action.capturedAt,
        });
        return result.ok
          ? { status: "sent", message: result.message }
          : { status: "rejected", error: result.error };
      }
      case "checkOut": {
        const payload = action.payload as CheckOutPayload;
        const result = await checkOutAction({
          coords: payload.coords,
          clientCapturedAt: action.capturedAt,
        });
        return result.ok
          ? { status: "sent", message: result.message }
          : { status: "rejected", error: result.error };
      }
      case "leaveRequest": {
        const payload = action.payload as LeavePayload;
        const result = await requestLeaveAction({
          ...payload,
          clientRequestId: action.id,
          clientCapturedAt: action.capturedAt,
        });
        return result.ok
          ? { status: "sent", message: result.message }
          : { status: "rejected", error: result.error };
      }
      case "taskProof": {
        const payload = action.payload as ProofPayload;
        // Upload the stored blobs first, then record the submission.
        const files = payload.files.map(
          (file) => new File([file.blob], file.name, { type: file.type }),
        );
        if (!payload.tenantId) {
          return {
            status: "rejected",
            error: "This proof was saved by an older version of the app. Open the task and send it again.",
          };
        }
        const uploaded = await uploadProofFiles(payload.tenantId, payload.taskId, files);
        if (!uploaded.ok) {
          // Storage refused the file (too large, wrong type): retrying
          // will not help, so tell the person.
          return { status: "rejected", error: uploaded.error };
        }
        const result = await submitProofAction({
          taskId: payload.taskId,
          note: payload.note,
          files: uploaded.files,
          clientRequestId: action.id,
          clientCapturedAt: action.capturedAt,
        });
        return result.ok
          ? { status: "sent", message: result.message }
          : { status: "rejected", error: result.error };
      }
      case "fieldTap": {
        const payload = action.payload as FieldTapPayload;
        const base = { coords: payload.coords, clientCapturedAt: action.capturedAt };
        let result;
        if (payload.tap === "GOING_OUT") result = await goingOutAction(base);
        else if (payload.tap === "LEAVE") result = await leaveAction({ ...base, note: payload.note });
        else if (payload.tap === "BACK") result = await backAtOfficeAction(base);
        else {
          if (!payload.arrive) return { status: "rejected", error: "That visit could not be read." };
          // The photo goes first; a failed upload is a lost signal, so try again.
          let photoPath: string | undefined;
          if (payload.photo) {
            const uploaded = await uploadMedia(payload.photo.tenantId, "visits", payload.photo.blob, "jpg");
            if (!uploaded.ok) return { status: "retry", error: uploaded.error };
            photoPath = uploaded.path;
          }
          result = await arriveAction({ ...base, ...payload.arrive, photoPath });
        }
        return result.ok
          ? { status: "sent", message: result.message }
          : { status: "rejected", error: result.error };
      }
      default:
        return { status: "rejected", error: "Unknown queued action." };
    }
  } catch (error) {
    return asRetry(error);
  }
}

/** Send everything waiting. Safe to call repeatedly; never runs twice at once. */
let running = false;

export async function runSync(): Promise<SyncSummary> {
  if (running) return summariseSync([]);
  running = true;
  try {
    const queue = sortQueue(
      (await listActions()).filter((a) => !a.failedPermanently),
    );
    const outcomes: SendOutcome[] = [];

    for (const action of queue) {
      if (typeof navigator !== "undefined" && !navigator.onLine) break;

      const outcome = await send(action);
      outcomes.push(outcome);

      const { remove, failedPermanently } = classifyOutcome(
        outcome,
        action.attempts,
      );
      if (remove) {
        await removeAction(action.id);
      } else {
        await putAction({
          ...action,
          attempts: action.attempts + 1,
          lastError: outcome.status === "sent" ? undefined : outcome.error,
          failedPermanently,
        });
      }
    }

    return summariseSync(outcomes);
  } finally {
    running = false;
  }
}
