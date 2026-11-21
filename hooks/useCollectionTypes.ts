import { useCallback, useMemo } from 'react';

import { t } from '../lib/i18n';
import {
  keys, refreshIfStale, refreshNow, useAlbumsCatalog, useCollectionTypesCatalog, useErasCatalog,
} from '../lib/queries';
import { CollectionTypeWithStats } from '../lib/types';

/** Tipos de coleccion del inicio, con cuantas eras y albumes tiene cada uno. */
export function useCollectionTypes() {
  const types = useCollectionTypesCatalog();
  const eras = useErasCatalog();
  const albums = useAlbumsCatalog();

  const result: CollectionTypeWithStats[] = useMemo(() => {
    if (!types.data) return [];
    const eraTypeMap: Record<number, number> = {};
    const erasByType: Record<number, number> = {};
    (eras.data ?? []).forEach((e: any) => {
      eraTypeMap[e.id] = e.collection_type_id;
      erasByType[e.collection_type_id] = (erasByType[e.collection_type_id] || 0) + 1;
    });
    const albumsByType: Record<number, number> = {};
    (albums.data?.albums ?? []).forEach((a: any) => {
      const typeId = a.era_id != null ? eraTypeMap[a.era_id] : undefined;
      if (typeId) albumsByType[typeId] = (albumsByType[typeId] || 0) + 1;
    });
    return types.data.map((ct: any) => ({
      ...ct,
      era_count: erasByType[ct.id] || 0,
      album_count: albumsByType[ct.id] || 0,
    }));
  }, [types.data, eras.data, albums.data]);

  const refetch = useCallback(() => {
    refreshNow(keys.collectionTypes);
    refreshNow(keys.erasCatalog);
    refreshNow(keys.albumsCatalog);
  }, []);
  const silentRefetch = useCallback(() => {
    refreshIfStale(keys.collectionTypes);
    refreshIfStale(keys.erasCatalog);
    refreshIfStale(keys.albumsCatalog);
  }, []);

  return {
    types: result,
    loading: types.isLoading,
    error: types.error ? t('errorTypes') : null,
    refetch,
    silentRefetch,
  };
}
