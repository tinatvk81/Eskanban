// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { useEffect, type ReactNode } from "react";
import type { PropertyDetail } from "@/lib/propertyTypes";
import EditFilePage from "./page";

const mocks = vi.hoisted(() => ({
  getCurrentUser: vi.fn(),
  getSessionToken: vi.fn(),
  apiFetch: vi.fn(),
  redirect: vi.fn((path: string): never => {
    throw new Error(`REDIRECT:${path}`);
  }),
  notFound: vi.fn((): never => {
    throw new Error("NOT_FOUND");
  }),
  propertyForm: vi.fn(),
  mounted: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  redirect: mocks.redirect,
  notFound: mocks.notFound,
}));

vi.mock("next/link", () => ({
  default: ({ href, children }: { href: string; children?: ReactNode }) => (
    <a href={href}>{children}</a>
  ),
}));

vi.mock("@/lib/session", () => ({
  getCurrentUser: mocks.getCurrentUser,
  getSessionToken: mocks.getSessionToken,
}));

vi.mock("@/lib/api", () => ({ apiFetch: mocks.apiFetch }));

vi.mock("@/i18n/getMessages", () => ({
  getMessages: () => ({
    errors: { unavailable: "Service unavailable" },
    fileDetail: { back: "Back" },
    auth: { logout: "Logout" },
    fileForm: { editTitle: "Edit property file", editIntro: "Intro text" },
  }),
}));

vi.mock("@/components/Topbar", () => ({
  Topbar: ({ children }: { children?: ReactNode }) => (
    <>
      <div data-testid="topbar" />
      {children}
    </>
  ),
}));

vi.mock("@/components/LogoutButton", () => ({
  LogoutButton: () => <div data-testid="logout-button" />,
}));

// Records every props object and every time the form is built from scratch (mounted).
vi.mock("@/components/PropertyForm", () => ({
  PropertyForm: (props: { edit?: { version: number } }) => {
    mocks.propertyForm(props);
    useEffect(() => {
      mocks.mounted(props.edit?.version);
    }, []);
    return <div data-testid="property-form" />;
  },
}));

const ID = "3f2b8c1e-5d4a-4b7e-9c1a-2e6f8a9b0c3d";
const OWNER = "7a1d4c2e-9b3f-4e5a-8c6d-1f2a3b4c5d6e";
const VOCAB = { deal_types: [{ key: "rent", fa: "اجاره", en: "Rent" }] };
const CITY = { id: 514, name: "مشهد", province_id: 11, province_name: "خراسان رضوی" };
const OPTIONS = [{ deposit: 100_000_000, monthly_rent: 12_000_000 }];

const PROP: PropertyDetail = {
  id: ID,
  version: 4,
  status: "active",
  deal_type: "rent",
  property_types: ["apartment"],
  owner: { id: OWNER, full_name: "Ali" },
  shared_with_agency: false,
  is_favorite: false,
  city: CITY,
  district: "سجاد",
  main_area_m2: 95,
  rooms: 2,
  floor: 3,
  price_total: null,
  deposit: 200_000_000,
  monthly_rent: 8_000_000,
  contract_end_date: "2027-03-20",
  is_urgent_now: false,
  deal_date: null,
  can_edit: true,
  address: "وکیل‌آباد",
  location_url: null,
  land_area_m2: null,
  built_area_m2: null,
  total_floors: null,
  total_units: null,
  build_year: null,
  direction: null,
  is_corner: false,
  amenities: [],
  custom_amenities: [],
  document_type: null,
  document_note: null,
  ownership_dang: 6,
  is_divided: null,
  deed_scope: null,
  ownership_kind: null,
  occupancy: null,
  vacate_date: null,
  owner_name: null,
  owner_phone: null,
  price_per_m2: null,
  convertible_options: OPTIONS,
  price_note: null,
  delivery_date: null,
  payment_terms: null,
  is_urgent: false,
  urgent_until: null,
  notes: null,
  last_confirmed_at: "2026-11-01T00:00:00Z",
  review_due_at: null,
  created_at: "2026-10-01T00:00:00Z",
  updated_at: "2026-11-01T00:00:00Z",
};

function signedIn(role: "manager" | "advisor", mustChange = false) {
  mocks.getCurrentUser.mockResolvedValue({
    status: "ok",
    data: { user: { role, must_change_password: mustChange } },
  });
}

const okProp = (over: Partial<PropertyDetail> = {}) => ({
  ok: true,
  status: 200,
  data: { ...PROP, ...over },
});

function api(prop: unknown, vocab: unknown = { ok: true, status: 200, data: VOCAB }) {
  mocks.apiFetch.mockImplementation(async (path: string) =>
    path === "/api/v1/vocab" ? vocab : prop,
  );
}

const page = (id = ID, locale = "fa") =>
  EditFilePage({ params: Promise.resolve({ locale, id }) });

beforeEach(() => {
  vi.clearAllMocks();
  mocks.getSessionToken.mockResolvedValue("token-1");
  signedIn("advisor");
  api(okProp());
});

afterEach(cleanup);

describe("edit file page", () => {
  it("redirects an anonymous visitor to login", async () => {
    mocks.getCurrentUser.mockResolvedValue({ status: "unauthenticated" });
    await expect(page()).rejects.toThrow("REDIRECT:/fa/login");
    expect(mocks.apiFetch).not.toHaveBeenCalled();
  });

  it("redirects to change-password when the user must change it", async () => {
    signedIn("advisor", true);
    await expect(page()).rejects.toThrow("REDIRECT:/fa/change-password");
  });

  it("returns not found for an unknown locale and for a bad id", async () => {
    await expect(page(ID, "xx")).rejects.toThrow("NOT_FOUND");
    await expect(page("not-a-uuid")).rejects.toThrow("NOT_FOUND");
    expect(mocks.apiFetch).not.toHaveBeenCalled();
  });

  it("returns not found when the file does not exist", async () => {
    api({ ok: false, status: 404, error: { code: "not_found" } });
    await expect(page()).rejects.toThrow("NOT_FOUND");
  });

  it("redirects to login when the backend says 401", async () => {
    api({ ok: false, status: 401, error: { code: "not_authenticated" } });
    await expect(page()).rejects.toThrow("REDIRECT:/fa/login");
  });

  it("sends someone who cannot edit back to the detail page without building the form", async () => {
    api(okProp({ can_edit: false }));
    await expect(page()).rejects.toThrow(`REDIRECT:/fa/files/${ID}`);
    expect(mocks.propertyForm).not.toHaveBeenCalled();
  });

  it("builds the form from the loaded file", async () => {
    signedIn("manager");
    render(await page());

    expect(screen.getByRole("heading", { name: "Edit property file" })).toBeTruthy();
    expect(screen.getByTestId("property-form")).toBeTruthy();
    expect(mocks.apiFetch).toHaveBeenCalledWith(`/api/v1/properties/${ID}`, { token: "token-1" });
    expect(mocks.propertyForm).toHaveBeenCalledWith(
      expect.objectContaining({
        isManager: true,
        advisors: [],
        edit: expect.objectContaining({
          id: ID,
          version: 4,
          city: CITY,
          convertibleOptions: OPTIONS,
          values: expect.objectContaining({
            deal_type: "rent",
            city_id: "514",
            address: "وکیل‌آباد",
            deposit: "200000000",
            owner_user_id: "",
          }),
        }),
      }),
    );
  });

  it("shows an alert instead of the form when the file cannot be loaded", async () => {
    api({ ok: false, status: 500, error: { code: "internal" } });
    render(await page());
    expect(screen.getByRole("alert").textContent).toBe("Service unavailable");
    expect(screen.queryByTestId("property-form")).toBeNull();
  });

  it("rebuilds the form when the file has a newer version (so a conflict can be cleared)", async () => {
    const { rerender } = render(await page());
    api(okProp({ version: 5 }));
    rerender(await page());
    expect(mocks.mounted.mock.calls.map((c) => c[0])).toEqual([4, 5]);
  });

  it("keeps the same form when the version has not changed", async () => {
    const { rerender } = render(await page());
    api(okProp({ version: 4, notes: "x" }));
    rerender(await page());
    expect(mocks.mounted.mock.calls.map((c) => c[0])).toEqual([4]);
  });
});
