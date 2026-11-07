export type VocabItem = { key: string; fa: string; en: string };
export type VocabMap = Record<string, VocabItem[]>;

export type PropertyRow = {
  id: string;
  version: number;
  status: string;
  deal_type: string;
  property_types: string[];
  owner: { id: string; full_name: string };
  shared_with_agency: boolean;
  is_favorite: boolean;
  city: { id: number; name: string; province_id: number; province_name: string };
  district: string | null;
  main_area_m2: number | string | null;
  rooms: number | null;
  floor: number | null;
  price_total: number | null;
  deposit: number | null;
  monthly_rent: number | null;
  contract_end_date: string | null;
  is_urgent_now: boolean;
};

export type PropertyList = {
  items: PropertyRow[];
  total: number;
  page: number;
  page_size: number;
  total_pages: number;
};