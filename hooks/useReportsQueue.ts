import { useCallback, useEffect, useState } from 'react';

import { getCardImageUrl, supabase } from '../lib/supabase';
import { ReportReason, ReportStatus } from '../lib/types';

/** Un reporte abierto, cruzado con la imagen y la card que lo motivan. */
export interface OpenReport {
  id: number;
  cardImageId: number;
  reason: ReportReason;
  detail: string | null;
  createdAt: string;
  cardId: number | null;
  cardName: string;
  cardCode: string;
  sourceType: string | null;
  /** URL de la imagen reportada. Null si vive en el bucket privado. */
  imageUrl: string | null;
  /** Cuantos reportes abiertos acumula esa misma imagen. */
  reportCount: number;
}

/**
 * Las unicas resoluciones que se ofrecen por ahora.
 *
 * `resolved_removed` existe en el enum pero NO se ofrece: retirar la imagen no
 * esta implementado. Para una legacy no basta con tocar card_images, porque
 * getCardImageUrl() cae de vuelta a cards.image_path y la Android v1 lee esa
 * columna directamente; y para una community aprobada haria falta borrar el
 * objeto del bucket publico, que solo puede service_role.
 */
export type ResolveAction = Extract<ReportStatus, 'resolved_kept' | 'dismissed'>;

export function useReportsQueue(enabled: boolean, adminId: string | null) {
  const [items, setItems] = useState<OpenReport[]>([]);
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

    // La policy "image_reports admin all" es la que deja ver los reportes de
    // cualquiera; un usuario normal solo ve los suyos.
    const { data: reports, error: reportsError } = await supabase
      .from('image_reports')
      .select('id, card_image_id, reason, detail, created_at')
      .eq('status', 'open')
      .order('created_at', { ascending: true });

    if (reportsError) {
      setError(reportsError.message);
      setLoading(false);
      return;
    }
    if (!reports || reports.length === 0) {
      setItems([]);
      setLoading(false);
      return;
    }

    const imageIds = Array.from(new Set(reports.map((r: any) => r.card_image_id as number)));

    const { data: images } = await supabase
      .from('card_images')
      .select('id, card_id, bucket_id, storage_path, source_type')
      .in('id', imageIds);

    const imageById = new Map<number, any>((images ?? []).map((i: any) => [i.id, i]));
    const cardIds = Array.from(new Set((images ?? []).map((i: any) => i.card_id as number)));

    const { data: cards } = await supabase
      .from('cards_full')
      .select('id, code, card_name')
      .in('id', cardIds.length > 0 ? cardIds : [-1]);

    const cardById = new Map<number, any>((cards ?? []).map((c: any) => [c.id, c]));

    // Cuantos reportes abiertos tiene cada imagen: tres reportes sobre la misma
    // imagen dicen algo distinto que uno solo.
    const countByImage = new Map<number, number>();
    for (const r of reports as any[]) {
      countByImage.set(r.card_image_id, (countByImage.get(r.card_image_id) ?? 0) + 1);
    }

    setItems((reports as any[]).map((r): OpenReport => {
      const image = imageById.get(r.card_image_id);
      const card = image ? cardById.get(image.card_id) : null;
      return {
        id: r.id,
        cardImageId: r.card_image_id,
        reason: r.reason,
        detail: r.detail,
        createdAt: r.created_at,
        cardId: image?.card_id ?? null,
        cardName: card?.card_name ?? '—',
        cardCode: card?.code ?? (image ? `#${image.card_id}` : '—'),
        sourceType: image?.source_type ?? null,
        // Solo los buckets publicos dan una URL directa. Una imagen que sigue en
        // revision no se puede mostrar asi, y no deberia tener reportes de todos
        // modos: no es visible para nadie mas que su autor.
        imageUrl: image && image.bucket_id !== 'photocard-community-review'
          ? getCardImageUrl({
              primary_image_path: image.storage_path,
              primary_image_bucket: image.bucket_id,
            })
          : null,
        reportCount: countByImage.get(r.card_image_id) ?? 1,
      };
    }));
    setLoading(false);
  }, [enabled]);

  useEffect(() => { fetchQueue(); }, [fetchQueue]);

  /**
   * Resolver es un UPDATE directo, sin edge function: no se mueve ningun objeto,
   * y la policy de admin ya permite escribir. La constraint
   * image_reports_resolved_has_reviewer exige resolved_by y resolved_at, asi que
   * no se puede cerrar un reporte sin dejar rastro.
   */
  const resolve = useCallback(async (
    reportId: number,
    action: ResolveAction,
    note?: string,
  ): Promise<{ ok: true } | { ok: false; error: string }> => {
    if (!adminId) return { ok: false, error: 'no session' };
    setWorking(reportId);
    try {
      const { error: updateError } = await supabase
        .from('image_reports')
        .update({
          status: action,
          resolved_by: adminId,
          resolved_at: new Date().toISOString(),
          resolution_note: note?.trim() || null,
        })
        .eq('id', reportId)
        .eq('status', 'open');

      if (updateError) return { ok: false, error: updateError.message };

      setItems(prev => prev.filter(item => item.id !== reportId));
      return { ok: true };
    } finally {
      setWorking(null);
    }
  }, [adminId]);

  return { items, loading, error, working, refetch: fetchQueue, resolve };
}
