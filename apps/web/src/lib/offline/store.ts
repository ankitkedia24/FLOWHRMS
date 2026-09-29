"use client";

import type { QueuedAction } from "./queue";

/**
 * Where queued actions live between attempts.
 *
 * IndexedDB, not localStorage: it survives the tab closing, has room for
 * proof photos, and stores Blobs directly rather than base64. Without
 * persistence the "Waiting to send" chip would be a lie — closing the app
 * would drop the work.
 *
 * No dependency: the surface we need is small enough to wrap by hand.
 */
const DB_NAME = "flowhrms-offline";
const DB_VERSION = 1;
const STORE = "queue";

function open(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === "undefined") {
      reject(new Error("This browser cannot save work offline."));
      return;
    }
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE, { keyPath: "id" });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function withStore<T>(
  mode: IDBTransactionMode,
  run: (store: IDBObjectStore) => IDBRequest<T>,
): Promise<T> {
  const db = await open();
  try {
    return await new Promise<T>((resolve, reject) => {
      const tx = db.transaction(STORE, mode);
      const request = run(tx.objectStore(STORE));
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
      tx.onabort = () => reject(tx.error);
    });
  } finally {
    db.close();
  }
}

/** True when this browser can hold work offline at all. */
export function offlineStorageAvailable(): boolean {
  return typeof indexedDB !== "undefined";
}

export async function putAction(action: QueuedAction): Promise<void> {
  await withStore("readwrite", (store) => store.put(action));
}

export async function listActions(): Promise<QueuedAction[]> {
  const all = await withStore<QueuedAction[]>("readonly", (store) =>
    store.getAll() as IDBRequest<QueuedAction[]>,
  );
  return all ?? [];
}

export async function removeAction(id: string): Promise<void> {
  await withStore("readwrite", (store) => store.delete(id));
}

export async function countActions(): Promise<number> {
  const all = await listActions();
  return all.filter((action) => !action.failedPermanently).length;
}

/** Clear everything — used when signing out, so work never crosses users. */
export async function clearActions(): Promise<void> {
  await withStore("readwrite", (store) => store.clear());
}
