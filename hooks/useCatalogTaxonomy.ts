import { useCallback, useEffect, useMemo, useState } from 'react';

import { supabase } from '../lib/supabase';
import {
  Album,
  AlbumEra,
  AlbumVersion,
  CardCategory,
  CardSet,
  CollectionType,
} from '../lib/types';

/**
 * La taxonomia del catalogo, para elegir donde va una card nueva.
 *
 * El formulario cascadea tipo -> era -> album -> version -> categoria -> set.
 * Los cinco primeros niveles suman 341 filas en total, asi que se bajan de una
 * y se filtran en memoria: partirlo en seis consultas encadenadas haria que
 * cada toque del formulario esperara a la red.
 *
 * Los card sets son la excepcion. Son 882 y solo importan los del album
 * elegido, asi que se piden aparte cuando hay album (`useCardSets`). Bajar los
 * 882 para mostrar 6 seria gastar el arranque del formulario en datos que casi
 * nunca se miran.
 */

export interface CatalogTaxonomy {
  types: CollectionType[];
  eras: AlbumEra[];
  albums: Album[];
  versions: AlbumVersion[];
  categories: CardCategory[];
  loading: boolean;
  error: string | null;
  refetch: () => void;
  /** Las eras de un tipo. */
  erasOf: (typeId: number | null) => AlbumEra[];
  /** Los albums de una era. */
  albumsOf: (eraId: number | null) => Album[];
  /** Las versiones de un album. Vacio si el album no tiene versiones. */
  versionsOf: (albumId: number | null) => AlbumVersion[];
}

export function useCatalogTaxonomy(): CatalogTaxonomy {
  const [types, setTypes] = useState<CollectionType[]>([]);
  const [eras, setEras] = useState<AlbumEra[]>([]);
  const [albums, setAlbums] = useState<Album[]>([]);
  const [versions, setVersions] = useState<AlbumVersion[]>([]);
  const [categories, setCategories] = useState<CardCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    setError(null);

    const [t, e, a, v, c] = await Promise.all([
      supabase.from('collection_types').select('*').eq('is_active', true).order('sort_order'),
      supabase.from('album_eras').select('*').eq('is_active', true).order('sort_order'),
      supabase.from('albums').select('*').eq('is_active', true).order('sort_order'),
      supabase.from('album_versions').select('*').order('sort_order'),
      supabase.from('card_categories').select('*').eq('is_active', true).order('sort_order'),
    ]);

    const failed = t.error || e.error || a.error || v.error || c.error;
    if (failed) {
      setError(failed.message);
      setLoading(false);
      return;
    }

    setTypes((t.data ?? []) as CollectionType[]);
    setEras((e.data ?? []) as AlbumEra[]);
    setAlbums((a.data ?? []) as Album[]);
    setVersions((v.data ?? []) as AlbumVersion[]);
    setCategories((c.data ?? []) as CardCategory[]);
    setLoading(false);
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const erasOf = useCallback(
    (typeId: number | null) =>
      typeId == null ? [] : eras.filter(x => x.collection_type_id === typeId),
    [eras],
  );

  const albumsOf = useCallback(
    (eraId: number | null) =>
      eraId == null ? [] : albums.filter(x => x.era_id === eraId),
    [albums],
  );

  const versionsOf = useCallback(
    (albumId: number | null) =>
      albumId == null ? [] : versions.filter(x => x.album_id === albumId),
    [versions],
  );

  return {
    types, eras, albums, versions, categories,
    loading, error, refetch: fetchAll,
    erasOf, albumsOf, versionsOf,
  };
}

/**
 * Los card sets de un album.
 *
 * Se piden cada vez que cambia el album y no se cachean: son pocos por album y
 * el formulario cambia de album una o dos veces como mucho.
 */
export function useCardSets(albumId: number | null) {
  const [sets, setSets] = useState<CardSet[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (albumId == null) {
      setSets([]);
      return;
    }
    let cancelled = false;
    setLoading(true);

    supabase
      .from('card_sets')
      .select('*')
      .eq('album_id', albumId)
      .eq('is_active', true)
      .order('sort_order')
      .then(({ data, error }) => {
        if (cancelled) return;
        // Un fallo aca no bloquea el envio: el card set es opcional, y dejar la
        // lista vacia es mejor que no poder proponer la card.
        if (error) console.error('[taxonomy] card_sets:', error.message);
        setSets((data ?? []) as CardSet[]);
        setLoading(false);
      });

    return () => { cancelled = true; };
  }, [albumId]);

  return { sets, loading };
}

/**
 * Los sets compatibles con la version y la categoria ya elegidas.
 *
 * Un set con `version_id` o `category_id` en null aplica a todo el album, asi
 * que sigue siendo candidato: null significa "cualquiera", no "ninguna".
 */
export function useFilteredCardSets(
  albumId: number | null,
  versionId: number | null,
  categoryId: number | null,
) {
  const { sets, loading } = useCardSets(albumId);

  const filtered = useMemo(
    () => sets.filter(s =>
      (s.version_id == null || versionId == null || s.version_id === versionId) &&
      (s.category_id == null || categoryId == null || s.category_id === categoryId)
    ),
    [sets, versionId, categoryId],
  );

  return { sets: filtered, allSets: sets, loading };
}
