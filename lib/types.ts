export type BiasKey = 'rm' | 'jin' | 'suga' | 'jhope' | 'jimin' | 'v' | 'jungkook';
export type Rarity = 'Common' | 'Rare' | 'Ultra Rare' | 'Limited';
export type CardStatus = 'have' | 'want' | 'otw' | 'not_collecting';

export interface CollectionType {
  id: number;
  name: string;
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
