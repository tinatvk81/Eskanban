export type Role = "manager" | "advisor";

export type ApiUser = {
  id: string;
  full_name: string;
  phone: string;
  email: string | null;
  role: Role;
  is_active: boolean;
  must_change_password: boolean;
};

export type ApiAgency = {
  id: string;
  name: string;
  slug: string;
  plan: "solo" | "small" | "large";
  seat_limit: number;
};

export type MeResponse = { user: ApiUser; agency: ApiAgency };

export type LoginResponse = {
  access_token: string;
  expires_at: string;
  must_change_password: boolean;
  user: ApiUser;
};

export type ApiErrorBody = { error: { code: string; message: string } };
