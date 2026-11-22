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

export type PropertyDetail = PropertyRow & {
  deal_date: string | null;
  can_edit: boolean;
  address: string | null;
  location_url: string | null;
  land_area_m2: number | string | null;
  built_area_m2: number | string | null;
  total_floors: number | null;
  total_units: number | null;
  build_year: number | null;
  direction: string | null;
  is_corner: boolean;
  amenities: string[];
  custom_amenities: string[];
  document_type: string | null;
  document_note: string | null;
  ownership_dang: number;
  is_divided: boolean | null;
  deed_scope: string | null;
  ownership_kind: string | null;
  occupancy: string | null;
  vacate_date: string | null;
  owner_name: string | null;
  owner_phone: string | null;
  price_per_m2: number | null;
  convertible_options: Record<string, unknown>[];
  price_note: string | null;
  delivery_date: string | null;
  payment_terms: string | null;
  is_urgent: boolean;
  urgent_until: string | null;
  notes: string | null;
  last_confirmed_at: string;
  review_due_at: string | null;
  created_at: string;
  updated_at: string;
};

export type PropertyStats = {
  total_active: number;
  by_deal_type: {
    sale: number;
    presale: number;
    rent: number;
    mortgage: number;
  };
  new_this_week: number;
  urgent: number;
  contracts_overdue: number;
  contracts_ending_7_days: number;
  contracts_ending_30_days: number;
};

export type HistoryEntry = {
  id: string;
  user: { id: string; full_name: string };
  action: string;
  changes: Record<string, unknown>;
  created_at: string;
};
