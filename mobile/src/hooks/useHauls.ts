import { useCallback, useEffect, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import { api, uploadFile, type UploadTarget } from '@/lib/api';
import type { Haul } from '@/lib/types';

const POLL_MS = 2500;
const isWorking = (h: Haul) => h.status === 'queued' || h.status === 'processing';

export type HaulVideo = { uri: string; mime: string; size: number };

// The seller's hauls, refreshed while the server is working, and the upload of a new one.
export function useHauls() {
  const [hauls, setHauls] = useState<Haul[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);

  const load = useCallback(async () => {
    try {
      const data = await api<{ hauls: Haul[] }>('/api/hauls');
      setHauls(data.hauls);
      setError(null);
    } catch (e) {
      setError((e as Error).message);
    }
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const working = !!hauls?.some(isWorking);
  useEffect(() => {
    if (!working) return;
    const timer = setInterval(load, POLL_MS);
    return () => clearInterval(timer);
  }, [working, load]);

  const upload = async ({ uri, mime, size }: HaulVideo) => {
    setUploading(true);
    setError(null);
    try {
      const created = await api<{ haul: Haul; upload: UploadTarget }>('/api/hauls', { method: 'POST', body: { mime, size } });
      await uploadFile(created.upload, uri);
      await api(`/api/hauls/${created.haul.id}/complete`, { method: 'POST' });
      await load();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setUploading(false);
    }
  };

  const remove = async (id: string) => {
    try {
      await api(`/api/hauls/${id}`, { method: 'DELETE' });
      await load();
    } catch (e) {
      setError((e as Error).message);
    }
  };

  return { hauls, error, uploading, upload, remove, reload: load };
}
