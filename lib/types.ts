export type BiasKey = 'rm' | 'jin' | 'suga' | 'jhope' | 'jimin' | 'v' | 'jungkook';
export type Rarity = 'Common' | 'Rare' | 'Ultra Rare' | 'Limited';
export type CardStatus = 'have' | 'want' | 'otw' | 'not_collecting';

/** Procedencia de una imagen. Ortogonal a su estado de moderacion. */
export type ImageSourceType = 'legacy' | 'community' | 'admin';
/** Estado de moderacion de una imagen. Ortogonal a su procedencia. */
export type ImageStatus = 'pending' | 'approved' | 'rejected';

/** Motivo de un reporte sobre una imagen. */
export type ReportReason =
  | 'wrong_card' | 'duplicate' | 'copyright' | 'inappropriate' | 'low_quality' | 'other';
/** Estado de un reporte. */
export type ReportStatus = 'open' | 'resolved_kept' | 'resolved_removed' | 'dismissed';

export interface ImageReport {
  id: number;
  card_image_id: number;
  reported_by: string | null;
  reason: ReportReason;
  detail: string | null;
  status: ReportStatus;
  resolved_by: string | null;
  resolved_at: string | null;
  resolution_note: string | null;
  created_at: string;
}

export interface CardImage {
  id: number;
  card_id: number;
  bucket_id: string;
  storage_path: string;
  source_type: ImageSourceType;
  status: ImageStatus;
  is_primary: boolean;
  contributed_by: string | null;
  reviewed_by: string | null;
  reviewed_at: string | null;
  rejection_reason: string | null;
  terms_accepted_at: string | null;
  terms_version: string | null;
  width: number | null;
  height: number | null;
  byte_size: number | null;
  created_at: string;
}

export interface CollectionType {
  id: number;
  name: string;
  name_en: string | null;
  short_name: string;
  color: string;
  icon: string | null;
  sort_order: number;
  is_active: boolean;
}

export interface CollectionTypeWithStats extends CollectionType {
  era_count: number;
  album_count: number;
}

export interface AlbumEra {
  id: number;
  collection_type_id: number;
  name: string;
  short_name: string | null;
  sort_order: number;
}

export interface AlbumEraWithAlbums extends AlbumEra {
  albums: AlbumWithStats[];
}

export interface Album {
  id: number;
  name: string;
  artist: string;
  short_name: string;
  release_year: number;
  release_date: string | null;
  color: string;
  cover_image_url: string | null;
  sort_order: number;
  is_active: boolean;
  era_id: number | null;
}

export interface AlbumVersion {
  id: number;
  album_id: number;
  name: string;
  short_name: string | null;
  sort_order: number;
}

export interface CardCategory {
  id: number;
  name: string;
  short_name: string;
  color: string;
  sort_order: number;
}

export interface CardFull {
  id: number;
  code: string;
  member: string;
  member_full_name: string | null;
  member_emoji: string | null;
  card_name: string;
  retailer: string | null;
  country: string | null;
  draw_type: string | null;
  rarity: Rarity;
  image_path: string | null;
  is_group: boolean;
  is_blurred: boolean;
  release_date: string | null;
  notes: string | null;
  album_id: number;
  album_name: string;
  album_short: string;
  album_color: string;
  album_cover: string | null;
  version_id: number | null;
  version_name: string | null;
  version_short: string | null;
  category_id: number;
  category_name: string;
  category_short: string;
  category_color: string;
  category_sort_order: number;

  /**
   * Imagen resuelta por `cards_full` segun la regla de display
   * (community > admin > legacy). `image_path` de arriba queda como la ruta
   * legacy cruda: se conserva por compatibilidad con la Android v1 publicada,
   * pero la app debe leer estos campos via getCardImageUrl().
   */
  primary_image_path: string | null;
  primary_image_bucket: string | null;
  primary_image_source: ImageSourceType | null;
  primary_image_contributed_by: string | null;
  /** `card_images.id` de la imagen resuelta. Necesario para reportarla. */
  primary_image_id: number | null;
}

export interface CardWithStatus extends CardFull {
  status: CardStatus | null;
  duplicate_count: number;
}

export interface AlbumWithStats extends Album {
  versions: AlbumVersion[];
  total_cards: number;
  owned_cards: number;
}

export interface MemberInfo {
  key: BiasKey;
  name: string;
  fullName: string;
  emoji: string;
  colors: [string, string, string];
}
