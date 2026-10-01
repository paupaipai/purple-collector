import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { CollectionTypeWithStats } from '../lib/types';
import { t } from '../lib/i18n';

export function useCollectionTypes() {
  const [types, setTypes] = useState<CollectionTypeWithStats[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchTypes = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    setError(null);

    const [
      { data: typesData, error: typesError },
      { data: erasData },
      { data: albumsData },
    ] = await Promise.all([
      supabase.from('collection_types').select('*').eq('is_active', true).order('sort_order'),
      supabase.from('album_eras').select('id, collection_type_id'),
      supabase.from('albums').select('id, era_id').eq('is_active', true),
    ]);

    if (typesError || !typesData) {
      setError(t('errorTypes'));
      setLoading(false);
      return;
    }

    // Build era → type mapping
    const eraTypeMap: Record<number, number> = {};
    erasData?.forEach((e: any) => { eraTypeMap[e.id] = e.collection_type_id; });

    // Count eras per type
    const erasByType: Record<number, number> = {};
    erasData?.forEach((e: any) => {
      erasByType[e.collection_type_id] = (erasByType[e.collection_type_id] || 0) + 1;
    });

    // Count albums per type
    const albumsByType: Record<number, number> = {};
    albumsData?.forEach((a: any) => {
      if (a.era_id != null) {
        const typeId = eraTypeMap[a.era_id];
        if (typeId) albumsByType[typeId] = (albumsByType[typeId] || 0) + 1;
      }
    });

    const result: CollectionTypeWithStats[] = typesData.map((ct: any) => ({
      ...ct,
      era_count: erasByType[ct.id] || 0,
      album_count: albumsByType[ct.id] || 0,
    }));

    setTypes(result);
    setLoading(false);
  }, []);

  useEffect(() => { fetchTypes(); }, [fetchTypes]);

  // Memoizadas, y esto NO es cosmetico: las pantallas hacen
  //   useFocusEffect(useCallback(() => silentRefetch(), [silentRefetch]))
  // y useFocusEffect depende de la identidad del callback. Si estas funciones
  // se recrearan en cada render, el efecto se volveria a disparar despues de
  // cada setState que el propio fetch provoca: refrescar -> render -> nueva
  // identidad -> refrescar. Medido antes de arreglarlo: 87 consultas en 25
  // segundos con la app QUIETA.
  const refetchNow = useCallback(() => fetchTypes(false), [fetchTypes]);
  const refetchSilently = useCallback(() => fetchTypes(true), [fetchTypes]);

  return {
    types,
    loading,
    error,
    refetch: refetchNow,
    silentRefetch: refetchSilently,
  };
}
