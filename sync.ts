import { db } from './db';

const SYNC_QUEUE_KEY = 'water_service_sync_queue';

function getQueue(): Set<string> {
  try {
    const data = localStorage.getItem(SYNC_QUEUE_KEY);
    return data ? new Set(JSON.parse(data)) : new Set();
  } catch {
    return new Set();
  }
}

function saveQueue(queue: Set<string>) {
  localStorage.setItem(SYNC_QUEUE_KEY, JSON.stringify(Array.from(queue)));
}

export async function addToSyncQueue(recordId: string) {
  const queue = getQueue();
  queue.add(recordId);
  saveQueue(queue);
  attemptSync();
}

export async function attemptSync() {
  if (!navigator.onLine) {
    console.log('[Sync] Offline. Will sync when online.');
    return;
  }

  const queue = getQueue();
  if (queue.size === 0) return;

  const workerUrl = import.meta.env.VITE_WORKER_URL;
  if (!workerUrl || workerUrl.includes('your-username.workers.dev')) {
    console.warn('[Sync] VITE_WORKER_URL is not configured (or is a placeholder). Skipping sync but clearing the queue.');
    queue.clear();
    saveQueue(queue);
    return;
  }

  console.log(`[Sync] Attempting to sync ${queue.size} records via Cloudflare Workers API...`);

  try {
    const queueArray = Array.from(queue);
    const recordsToSync = [];
    
    for (const id of queueArray) {
      const record = await db.records.get(id);
      if (record) {
        recordsToSync.push(record);
      }
    }

    if (recordsToSync.length > 0) {
      const baseUrl = workerUrl.replace(/\/+$/, '');
      const syncEndpoint = `${baseUrl}/sync`;
      const response = await fetch(syncEndpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ records: recordsToSync }),
      });

      if (!response.ok) {
        throw new Error(`Failed to sync to worker at ${syncEndpoint} (Status: ${response.status} - ${response.statusText})`);
      }
    }

    console.log(`[Sync] Successfully synced records to ${workerUrl}`);
    queue.clear();
    saveQueue(queue);
  } catch (error) {
    console.error('[Sync] Sync failed, will retry later.', error);
  }
}

// Auto-sync when coming back online
if (typeof window !== 'undefined') {
  window.addEventListener('online', () => {
    console.log('[Sync] Back online! Attempting sync...');
    attemptSync();
  });
}
