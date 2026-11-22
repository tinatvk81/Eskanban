export type ListingStatus = "new" | "dismissed" | "converted";

export type ListingRow = {
  id: string; // listing_inbox id — this is what BFF actions use
  source: string;
  external_id: string;
  url: string;
  title: string | null;
  owner_name: string | null;
  owner_phone: string | null;
  address: string | null;
  city_id: number | null;
  district: string | null;
  deal_type: string | null;
  property_types: string[];
  price_total: number | null;
  deposit: number | null;
  monthly_rent: number | null;
  posted_at: string | null;
  is_gone: boolean;
  status: ListingStatus;
  converted_property_id: string | null;
};

export type ListingPage = {
  items: ListingRow[];
  total: number;
  page: number;
  page_size: number;
  total_pages: number;
};
