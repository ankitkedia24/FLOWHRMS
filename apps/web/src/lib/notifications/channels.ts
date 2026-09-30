import { isFeatureBuilt } from "@/lib/catalog";
import { NOTIFICATION_CHANNELS, NOTIFICATION_EVENTS } from "@/lib/settings/constants";
import { STATUS, type Status } from "@/lib/status";

/**
 * What each notification channel can truthfully be shown as.
 *
 * notify() (./index.ts) writes the in-app notice and nothing else. Push,
 * email, SMS and WhatsApp are catalog features marked `built: false`, so a
 * company's saved "on" — or the catalog default, which was on for push and
 * email — delivers nothing, and showing it as Enabled told owners their
 * people were being emailed and buzzed when nobody was (hardening batch 7).
 *
 * The notification settings and the daily report both ask here, so they
 * cannot disagree. When a channel is built, dropping its `built: false`
 * is enough: from then on this reads the company's switch.
 *
 * Account emails — invitations, email confirmation, password changes,
 * payment receipts — go out over SMTP whatever this says. They are not
 * notifications and no flag governs them.
 *
 * Pure, and free of server-only imports, so it can be unit-tested and used
 * from any component.
 */

export interface ChannelState {
  key: string;
  label: string;
  /** In-app: every event, for everyone — not a choice. */
  alwaysOn: boolean;
  /** Does anything actually reach a person this way? */
  delivers: boolean;
  /** Why not, shown beside the disabled control. Absent when it delivers. */
  reason?: string;
  status: Status;
}

/** Channels that are a real choice: built, and not always on. */
function choosableChannelKeys(): Set<string> {
  return new Set(
    NOTIFICATION_CHANNELS.filter(
      (c) => !c.alwaysOn && isFeatureBuilt("NOTIFICATIONS", c.key),
    ).map((c) => c.key),
  );
}

/**
 * Every channel, in display order, with what it really does for this
 * company. `isSwitchedOn` is the company's feature switch for a channel;
 * it is only asked about channels that are built.
 */
export function notificationChannelStates(
  isSwitchedOn: (featureKey: string) => boolean,
): ChannelState[] {
  return NOTIFICATION_CHANNELS.map(({ key, label, alwaysOn }): ChannelState => {
    if (alwaysOn) {
      return { key, label, alwaysOn, delivers: true, status: STATUS.enabled };
    }
    if (!isFeatureBuilt("NOTIFICATIONS", key)) {
      return {
        key,
        label,
        alwaysOn,
        delivers: false,
        reason: STATUS.notAvailableYet.label,
        status: STATUS.notAvailableYet,
      };
    }
    return isSwitchedOn(key)
      ? { key, label, alwaysOn, delivers: true, status: STATUS.enabled }
      : {
          key,
          label,
          alwaysOn,
          delivers: false,
          reason: "Switched off in Module Management",
          status: STATUS.disabled,
        };
  });
}

/**
 * The part of an event × channel matrix worth storing: known events on
 * channels that are a real choice. A tick for a channel nothing sends on
 * is dropped when the settings are saved, so the stored policy never
 * claims a message that will never go out. In-app is always on and is not
 * stored. The policy keeps its shape — `matrix` just holds fewer entries.
 */
export function choosableMatrix(
  matrix: Readonly<Record<string, boolean>>,
): Record<string, boolean> {
  const events = new Set<string>(NOTIFICATION_EVENTS.map((e) => e.key));
  const channels = choosableChannelKeys();
  const kept: Record<string, boolean> = {};
  for (const [id, on] of Object.entries(matrix)) {
    const dot = id.lastIndexOf(".");
    if (dot <= 0) continue;
    if (events.has(id.slice(0, dot)) && channels.has(id.slice(dot + 1))) {
      kept[id] = on;
    }
  }
  return kept;
}
