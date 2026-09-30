import { useCallback, useEffect, useState } from 'react';

import { COMMUNITY_REVIEW_BUCKET } from '../lib/constants';
import { SubmissionRejectReason } from '../lib/submissions';
import { supabase } from '../lib/supabase';

/**
 * La bandeja de propuestas de cards nuevas.
 *
 * Es hermana de useModerationQueue --que revisa imagenes para cards que ya
 * existen-- pero lo que se decide aca es distinto: aprobar CREA una card en el
 * catalogo. De ahi que la ficha traiga la cadena taxonomica completa y las
 * notas: no se esta juzgando una foto, se esta juzgando si esa card existe y si
 * va donde dice que va.
 */
export interface PendingCardSubmission {
  id: number;
  createdAt: string;
  storagePath: string;
  /** URL firmada: el bucket de revision es privado, no hay URL publica. */
  signedUrl: string | null;
  member: string;
  cardName: string;
  notes: string | null;
  handle: string | null;
  typeName: string | null;
  eraName: string | null;
  albumName: string;
  versionName: string | null;
  categoryName: string;
  cardSetName: string | null;
  /** Lo que el set aporta y la card heredara: retailer, pais, draw type. */
  cardSetDetail: string | null;
}

// 10 minutos alcanza para revisar una tanda y evita dejar URLs vivas de mas.
const SIGNED_URL_TTL_SECONDS = 600;

export function useSubmissionsQueue(enabled: boolean) {
  const [items, setItems] = useState<PendingCardSubmission[]>([]);
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

    // La policy "card_submissions admin all" es la que deja ver las de
    // cualquiera; sin ella se verian solo las propias.
    //
    // Los nombres vienen embebidos en la misma consulta: son seis tablas de
    // catalogo y traerlas aparte serian seis viajes mas para pintar una ficha.
    const { data, error: queryError } = await supabase
      .from('card_submissions')
      .select(`
        id, created_at, storage_path, member, card_name, notes, contributor_handle,
        collection_types ( name ),
        album_eras ( name ),
        albums ( name ),
        album_versions ( name ),
        card_categories ( name ),
        card_sets ( name, retailer, country, draw_type )
      `)
      .eq('status', 'pending')
      .order('created_at', { ascending: true });

    if (queryError) {
      setError(queryError.message);
      setLoading(false);
      return;
    }
    if (!data || data.length === 0) {
      setItems([]);
      setLoading(false);
      return;
    }

    // Una URL firmada por propuesta: el bucket es privado a proposito, asi que
    // no hay forma de mostrarlas sin firmar.
    const paths = (data as any[]).map(r => r.storage_path as string);
    const { data: signed } = await supabase.storage
      .from(COMMUNITY_REVIEW_BUCKET)
      .createSignedUrls(paths, SIGNED_URL_TTL_SECONDS);

    const urlByPath = new Map<string, string>(
      (signed ?? [])
        .filter((s: any) => s.signedUrl && !s.error)
        .map((s: any) => [s.path as string, s.signedUrl as string]),
    );

    setItems((data as any[]).map((row): PendingCardSubmission => {
      const set = row.card_sets;
      const detail = set
        ? [set.retailer, set.country, set.draw_type].filter(Boolean).join(' · ')
        : '';
      return {
        id: row.id,
        createdAt: row.created_at,
        storagePath: row.storage_path,
        signedUrl: urlByPath.get(row.storage_path) ?? null,
        member: row.member,
        cardName: row.card_name,
        notes: row.notes,
        handle: row.contributor_handle,
        typeName: row.collection_types?.name ?? null,
        eraName: row.album_eras?.name ?? null,
        albumName: row.albums?.name ?? '—',
        versionName: row.album_versions?.name ?? null,
        categoryName: row.card_categories?.name ?? '—',
        cardSetName: set?.name ?? null,
        cardSetDetail: detail || null,
      };
    }));
    setLoading(false);
  }, [enabled]);

  useEffect(() => { fetchQueue(); }, [fetchQueue]);

  /**
   * Aprobar o rechazar.
   *
   * Siempre por la edge function, nunca por un UPDATE: aprobar significa crear
   * una fila en `cards`, mover el objeto al bucket publico y registrar la imagen
   * en `card_images`. La tabla no tiene ni siquiera grant de UPDATE para
   * authenticated, justamente para que no exista un camino corto que deje una
   * propuesta aprobada sin card.
   */
  const moderate = useCallback(async (
    submissionId: number,
    action: 'approve' | 'reject',
    reason?: SubmissionRejectReason,
  ): Promise<{ ok: true; cardId?: number } | { ok: false; error: string }> => {
    setWorking(submissionId);
    try {
      const { data, error: fnError } = await supabase.functions.invoke('moderate-card-submission', {
        body: { action, submissionId, reason },
      });

      if (fnError) {
        let detail = fnError.message ?? String(fnError);
        try {
          const body = await (fnError as any).context?.json?.();
          if (body?.error) detail = body.error;
        } catch {}
        return { ok: false, error: detail };
      }
      if (data && data.success === false) {
        return { ok: false, error: String(data.error ?? 'unknown error') };
      }

      setItems(prev => prev.filter(item => item.id !== submissionId));
      return { ok: true, cardId: data?.cardId };
    } finally {
      setWorking(null);
    }
  }, []);

  return { items, loading, error, working, refetch: fetchQueue, moderate };
}
