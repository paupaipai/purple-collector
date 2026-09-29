import { useCallback, useEffect, useState } from 'react';

import { COMMUNITY_REVIEW_BUCKET } from '../lib/constants';
import { getCardImageUrl, supabase } from '../lib/supabase';

/** Una aportacion pendiente, ya cruzada con los datos de su card. */
export interface PendingSubmission {
  id: number;
  cardId: number;
  createdAt: string;
  storagePath: string;
  /** URL firmada: el bucket de revision es privado, no hay URL publica. */
  signedUrl: string | null;
  cardCode: string;
  cardName: string;
  member: string;
  albumShort: string;
  categoryName: string;
  /** La imagen que se muestra hoy, para poder comparar antes de aprobar. */
  currentUrl: string | null;
  currentSource: string | null;
}

/** Los motivos de rechazo se guardan en card_images.rejection_reason. */
export type RejectReason = 'wrong_card' | 'low_quality' | 'no_rights' | 'duplicate';

// 10 minutos alcanza para revisar una tanda y evita dejar URLs vivas de mas.
const SIGNED_URL_TTL_SECONDS = 600;

function errorMessage(error: any): string {
  return String(error?.message ?? error ?? 'unknown error');
}

export function useModerationQueue(enabled: boolean) {
  const [items, setItems] = useState<PendingSubmission[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [working, setWorking] = useState<number | null>(null);

  const fetchQueue = useCallback(async () => {
    if (!enabled) {
      setItems([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);

    // La policy "card_images admin all" es la que deja ver las pending de
    // cualquiera; un usuario normal solo veria las suyas.
    const { data: rows, error: rowsError } = await supabase
      .from('card_images')
      .select('id, card_id, storage_path, created_at')
      .eq('status', 'pending')
      .eq('source_type', 'community')
      .order('created_at', { ascending: true });

    if (rowsError) {
      setError(errorMessage(rowsError));
      setLoading(false);
      return;
    }
    if (!rows || rows.length === 0) {
      setItems([]);
      setLoading(false);
      return;
    }

    const cardIds = Array.from(new Set(rows.map((r: any) => r.card_id as number)));

    const [{ data: cards }, signed] = await Promise.all([
      supabase
        .from('cards_full')
        .select('id, code, card_name, member, album_short, category_name, primary_image_path, primary_image_bucket, primary_image_source')
        .in('id', cardIds),
      supabase.storage
        .from(COMMUNITY_REVIEW_BUCKET)
        .createSignedUrls(rows.map((r: any) => r.storage_path as string), SIGNED_URL_TTL_SECONDS),
    ]);

    const cardById = new Map<number, any>((cards ?? []).map((c: any) => [c.id, c]));
    const urlByPath = new Map<string, string | null>(
      (signed.data ?? []).map((s: any) => [s.path as string, (s.signedUrl as string) ?? null]),
    );

    setItems(rows.map((row: any): PendingSubmission => {
      const card = cardById.get(row.card_id);
      return {
        id: row.id,
        cardId: row.card_id,
        createdAt: row.created_at,
        storagePath: row.storage_path,
        signedUrl: urlByPath.get(row.storage_path) ?? null,
        cardCode: card?.code ?? `#${row.card_id}`,
        cardName: card?.card_name ?? '—',
        member: card?.member ?? '—',
        albumShort: card?.album_short ?? '—',
        categoryName: card?.category_name ?? '—',
        currentUrl: card ? getCardImageUrl(card) : null,
        currentSource: card?.primary_image_source ?? null,
      };
    }));
    setLoading(false);
  }, [enabled]);

  useEffect(() => { fetchQueue(); }, [fetchQueue]);

  /**
   * Aprobar y rechazar pasan por la edge function, no por un UPDATE directo:
   * aprobar exige MOVER el objeto del bucket privado al publico, y eso solo lo
   * puede hacer service_role. supabase-js adjunta el access token de la sesion,
   * que es lo que la funcion verifica antes de comprobar is_admin.
   */
  const moderate = useCallback(async (
    cardImageId: number,
    action: 'approve' | 'reject',
    reason?: RejectReason,
  ): Promise<{ ok: true } | { ok: false; error: string }> => {
    setWorking(cardImageId);
    try {
      const { data, error: fnError } = await supabase.functions.invoke('moderate-card-image', {
        body: { action, cardImageId, reason },
      });

      if (fnError) {
        // FunctionsHttpError lleva la respuesta real en context; sin esto solo
        // se veria un "non-2xx status code" sin el motivo.
        let detail = errorMessage(fnError);
        try {
          const body = await (fnError as any).context?.json?.();
          if (body?.error) detail = body.error;
        } catch {}
        return { ok: false, error: detail };
      }
      if (data && data.success === false) {
        return { ok: false, error: String(data.error ?? 'unknown error') };
      }

      // Fuera de la cola en cuanto se resuelve, sin esperar el refetch.
      setItems(prev => prev.filter(item => item.id !== cardImageId));
      return { ok: true };
    } finally {
      setWorking(null);
    }
  }, []);

  return { items, loading, error, working, refetch: fetchQueue, moderate };
}
