export interface LocalEvidenceRecord {
  case_id: string;
  workflow_id?: string | null;
  verifier_id: string;
  latitude: number;
  longitude: number;
  accuracy_m?: number | null;
  captured_at: string | null;
  photo_hash?: string | null;
  sequence?: number | null;
  notes?: string | null;
  task_id?: string | null;
  photo: File | null;
  // Stable client-generated idempotency key (API-02): sent on every replay so
  // a retry after a lost response resolves to the same server row instead of
  // inserting a duplicate. Assigned once at saveLocalEvidence.
  client_token?: string;
  upload_state?: 'pending' | 'uploading' | 'uploaded' | 'failed';
  upload_progress?: number;
  retry_count?: number;
}

const STORAGE_KEY = 'bhoomisetu_verifier_local_evidence';
const MAX_RETRIES = 3;

export function getLocalQueue(): LocalEvidenceRecord[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const items = JSON.parse(raw);
    return items.map((item: any) => {
      let photo: File | null = null;
      if (item.photo_data_url) {
        try {
          const parts = item.photo_data_url.split(',');
          const byteString = atob(parts[1]);
          const mime = parts[0].split(':')[1].split(';')[0];
          const ab = new ArrayBuffer(byteString.length);
          const ia = new Uint8Array(ab);
          for (let i = 0; i < byteString.length; i++) {
            ia[i] = byteString.charCodeAt(i);
          }
          photo = new File([ab], item.photo_name || 'photo.jpg', { type: mime });
        } catch (_e) {
          photo = null;
        }
      }
      return {
        case_id: item.case_id,
        workflow_id: item.workflow_id,
        verifier_id: item.verifier_id,
        latitude: item.latitude,
        longitude: item.longitude,
        accuracy_m: item.accuracy_m,
        captured_at: item.captured_at,
        photo_hash: item.photo_hash,
        sequence: item.sequence,
        notes: item.notes,
        task_id: item.task_id,
        photo,
        client_token: item.client_token,
        upload_state: item.upload_state || 'pending',
        upload_progress: item.upload_progress || 0,
        retry_count: item.retry_count || 0,
      };
    });
  } catch {
    return [];
  }
}

function fileToDataURL(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export async function saveLocalEvidence(record: LocalEvidenceRecord): Promise<void> {
  // Assign the idempotency key once, at first save, so it survives reloads and
  // every replay carries the same token (API-02).
  if (!record.client_token) {
    record.client_token =
      (typeof crypto !== 'undefined' && crypto.randomUUID)
        ? crypto.randomUUID()
        : `evd-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  }
  let serialized: any = { ...record };
  if (record.photo) {
    const dataUrl = await fileToDataURL(record.photo);
    serialized.photo_data_url = dataUrl;
    serialized.photo_name = record.photo.name;
  }
  serialized.photo = null;

  // Surface persistence failures (API-02): swallowing a QuotaExceededError here
  // silently drops the only offline copy of the evidence. Let the caller catch
  // it and warn the verifier instead of pretending it was queued.
  try {
    const existingSerialized = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
    existingSerialized.push(serialized);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(existingSerialized));
  } catch (err) {
    throw new Error(
      'Could not save evidence for offline sync (device storage may be full). ' +
      'Free up space or reconnect to upload now.',
    );
  }
}

export function clearLocalQueue(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // Silently fail
  }
}

export function updateLocalEvidence(index: number, updates: Partial<LocalEvidenceRecord>): void {
  try {
    const existing = getLocalQueue();
    if (index >= 0 && index < existing.length) {
      existing[index] = { ...existing[index], ...updates };
      const serialized = existing.map(item => {
        let s: any = { ...item };
        if (item.photo) {
          // Don't re-serialize photo, keep existing data_url
        }
        s.photo = null;
        return s;
      });
      localStorage.setItem(STORAGE_KEY, JSON.stringify(serialized));
    }
  } catch {
    // Silently fail
  }
}

export function removeLocalEvidence(index: number): void {
  try {
    const existing = getLocalQueue();
    if (index >= 0 && index < existing.length) {
      existing.splice(index, 1);
      const serialized = existing.map(item => {
        let s: any = { ...item };
        s.photo = null;
        return s;
      });
      localStorage.setItem(STORAGE_KEY, JSON.stringify(serialized));
    }
  } catch {
    // Silently fail
  }
}

export function isOnline(): boolean {
  return navigator.onLine;
}

export function subscribeToConnectivity(callback: () => void): () => void {
  window.addEventListener('online', callback);
  window.addEventListener('offline', callback);
  return () => {
    window.removeEventListener('online', callback);
    window.removeEventListener('offline', callback);
  };
}

// Automatic sync when online - processes queue with retry logic
export async function autoSyncQueue(
  apiService: any,
  onProgress?: (synced: number, failed: number, total: number) => void
): Promise<{ synced: number; failed: number }> {
  if (!isOnline()) {
    return { synced: 0, failed: 0 };
  }

  const queue = getLocalQueue();
  const pending = queue.filter(r => r.upload_state !== 'uploaded');
  if (pending.length === 0) {
    return { synced: 0, failed: 0 };
  }

  let synced = 0;
  let failed = 0;

  for (let i = 0; i < pending.length; i++) {
    const record = pending[i];
    const originalIndex = queue.indexOf(record);

    try {
      // Update progress
      updateLocalEvidence(originalIndex, { upload_state: 'uploading', upload_progress: 0 });

      // Replay to the workflow field-evidence pipeline (multipart, real photo
      // bytes) — same path the online submit uses, so queued evidence surfaces
      // in the officer's review panel with working images. Records queued
      // before workflow_id was captured, or with no photo, are dropped as
      // unreplayable rather than silently posting hash-only rows.
      if (!record.workflow_id || !record.photo) {
        throw new Error('Queued evidence is missing workflow or photo; cannot replay');
      }
      const form = new FormData();
      form.append('photo', record.photo);
      form.append('latitude', String(record.latitude));
      form.append('longitude', String(record.longitude));
      form.append('capturedAt', record.captured_at || new Date().toISOString());
      if (record.notes) form.append('notes', record.notes);
      // Idempotency key so a retried replay doesn't duplicate the row (API-02).
      if (record.client_token) form.append('clientToken', record.client_token);

      const response = await apiService.post(
        `/workflows/${record.workflow_id}/field-evidence`,
        form,
        { headers: { 'Content-Type': undefined } },
      );

      // Response is CamelModel → `id` on the created FieldEvidence row.
      if (response.data?.id) {
        updateLocalEvidence(originalIndex, {
          upload_state: 'uploaded',
          upload_progress: 100,
        });
        synced++;
      } else {
        throw new Error('No evidenceId returned');
      }
    } catch (err) {
      const retryCount = (record.retry_count || 0) + 1;
      if (retryCount <= MAX_RETRIES) {
        updateLocalEvidence(originalIndex, {
          upload_state: 'failed',
          upload_progress: 0,
          retry_count: retryCount,
        });
        // Will retry on next autoSync
      } else {
        updateLocalEvidence(originalIndex, {
          upload_state: 'failed',
          upload_progress: 0,
          retry_count: retryCount,
        });
        failed++;
      }
    }

    onProgress?.(synced, failed, pending.length);
  }

  // Clean up uploaded items
  const remaining = getLocalQueue().filter(r => r.upload_state !== 'uploaded');
  const serialized = remaining.map(item => {
    let s: any = { ...item };
    s.photo = null;
    return s;
  });
  localStorage.setItem(STORAGE_KEY, JSON.stringify(serialized));

  return { synced, failed };
}
