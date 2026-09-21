export interface LocalEvidenceRecord {
  case_id: string;
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
}

const STORAGE_KEY = 'bhoomisetu_verifier_local_evidence';

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
  try {
    let serialized: any = { ...record };
    if (record.photo) {
      const dataUrl = await fileToDataURL(record.photo);
      serialized.photo_data_url = dataUrl;
      serialized.photo_name = record.photo.name;
    }
    serialized.photo = null;

    const existing = getLocalQueue();
    const existingSerialized = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
    existingSerialized.push(serialized);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(existingSerialized));
  } catch {
    // Silently fail - offline mode degrades gracefully
  }
}

export function clearLocalQueue(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
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
