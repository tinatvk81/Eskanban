// @vitest-environment jsdom
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import * as faModule from "@/i18n/messages/fa";
import type { Messages } from "@/i18n/messages/types";
import { errorText } from "@/lib/errorText";
import { formatToman } from "@/lib/format";
import type { ListingRow } from "@/lib/listingTypes";
import type { VocabMap } from "@/lib/propertyTypes";
import { ListingsTable } from "./ListingsTable";

const { refresh, replace } = vi.hoisted(() => ({ refresh: vi.fn(), replace: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh, replace }) }));

const mod = faModule as unknown as Record<string, unknown>;
const t = (mod.default ?? mod.fa) as Messages;
if (!t) throw new Error("cannot find the fa messages export in @/i18n/messages/fa");
const l = t.listings;

const vocab = {
  deal_types: [{ key: "sale", fa: "فروش", en: "Sale" }],
} as unknown as VocabMap;

function makeRow(over: Partial<ListingRow> = {}): ListingRow {
  return {
    id: "11111111-1111-4111-8111-111111111111",
    source: "divar",
    external_id: "https://divar.ir/v/abc",
    url: "https://divar.ir/v/abc",
    title: "آپارتمان ۸۰ متری",
    owner_name: null,
    owner_phone: null,
    address: null,
    city_id: null,
    district: null,
    deal_type: null,
    property_types: [],
    price_total: null,
    deposit: null,
    monthly_rent: null,
    posted_at: null,
    is_gone: false,
    status: "new",
    converted_property_id: null,
    ...over,
  } as unknown as ListingRow;
}

const fetchMock = vi.fn();

function renderTable(rows: ListingRow[]) {
  return render(<ListingsTable rows={rows} vocab={vocab} locale="fa" t={t} />);
}

beforeEach(() => {
  refresh.mockReset();
  replace.mockReset();
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("ListingsTable rendering", () => {
  it("shows the source badge and a safe link to the original ad", () => {
    renderTable([makeRow()]);
    expect(screen.getByText("divar")).toBeTruthy();
    const link = screen.getByRole("link", { name: l.viewOriginal });
    expect(link.getAttribute("href")).toBe("https://divar.ir/v/abc");
    expect(link.getAttribute("target")).toBe("_blank");
    expect(link.getAttribute("rel")).toContain("noreferrer");
    expect(link.getAttribute("rel")).toContain("noopener");
  });

  it("shows owner name and phone when present", () => {
    renderTable([makeRow({ owner_name: "آقای احمدی", owner_phone: "09121112233" })]);
    expect(screen.getByText("آقای احمدی")).toBeTruthy();
    expect(screen.getByText("09121112233")).toBeTruthy();
  });

  it("formats the price", () => {
    renderTable([makeRow({ price_total: 5_000_000_000 })]);
    expect(screen.getByText(formatToman(5_000_000_000, "fa", t.files.units))).toBeTruthy();
  });

  it("new rows have dismiss and convert buttons", () => {
    renderTable([makeRow({ status: "new" })]);
    expect(screen.getByRole("button", { name: l.dismiss })).toBeTruthy();
    expect(screen.getByRole("button", { name: l.convert })).toBeTruthy();
  });

  it("converted rows link to the created file and have no action buttons", () => {
    renderTable([makeRow({ status: "converted", converted_property_id: "abc-123" })]);
    const link = screen.getByRole("link", { name: l.openFile });
    expect(link.getAttribute("href")).toBe("/fa/files/abc-123");
    expect(screen.queryByRole("button", { name: l.dismiss })).toBeNull();
    expect(screen.queryByRole("button", { name: l.convert })).toBeNull();
  });

  it("dismissed rows have no action buttons", () => {
    renderTable([makeRow({ status: "dismissed" })]);
    expect(screen.queryByRole("button", { name: l.dismiss })).toBeNull();
    expect(screen.queryByRole("button", { name: l.convert })).toBeNull();
  });
});

describe("ListingsTable dismiss", () => {
  it("POSTs to the dismiss route and refreshes", async () => {
    fetchMock.mockResolvedValue({ ok: true, status: 200 });
    const row = makeRow();
    renderTable([row]);
    await userEvent.setup().click(screen.getByRole("button", { name: l.dismiss }));
    await waitFor(() => expect(refresh).toHaveBeenCalledTimes(1));
    expect(fetchMock.mock.calls[0][0]).toBe(`/api/listings/${row.id}/dismiss`);
    expect(fetchMock.mock.calls[0][1].method).toBe("POST");
  });

  it("redirects to login on 401", async () => {
    fetchMock.mockResolvedValue({ ok: false, status: 401, json: async () => ({}) });
    renderTable([makeRow()]);
    await userEvent.setup().click(screen.getByRole("button", { name: l.dismiss }));
    await waitFor(() => expect(replace).toHaveBeenCalledWith("/fa/login"));
    expect(refresh).not.toHaveBeenCalled();
  });
});

describe("ListingsTable convert", () => {
  it("opens the convert form and blocks submit without deal type and city", async () => {
    const user = userEvent.setup();
    renderTable([makeRow({ deal_type: null, city_id: null })]);
    await user.click(screen.getByRole("button", { name: l.convert }));
    await user.click(screen.getByRole("button", { name: l.convertConfirm }));
    expect((await screen.findByRole("alert")).textContent).toBe(l.convertMissing);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("submits deal_type and numeric city_id, then refreshes and closes the form", async () => {
    fetchMock.mockResolvedValue({ ok: true, status: 201 });
    const user = userEvent.setup();
    const row = makeRow({ deal_type: null, city_id: null });
    renderTable([row]);
    await user.click(screen.getByRole("button", { name: l.convert }));
    await user.selectOptions(screen.getByLabelText(l.dealTypeLabel), "sale");
    await user.type(screen.getByLabelText(l.cityIdLabel), "5");
    await user.click(screen.getByRole("button", { name: l.convertConfirm }));

    await waitFor(() => expect(refresh).toHaveBeenCalledTimes(1));
    expect(fetchMock.mock.calls[0][0]).toBe(`/api/listings/${row.id}/convert`);
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual({ deal_type: "sale", city_id: 5 });
    expect(screen.queryByLabelText(l.dealTypeLabel)).toBeNull();
  });

  it("shows the mapped error text when the server rejects", async () => {
    fetchMock.mockResolvedValue({
      ok: false,
      status: 409,
      json: async () => ({ error: { code: "some_server_code" } }),
    });
    const user = userEvent.setup();
    renderTable([makeRow({ deal_type: "sale", city_id: 5 })]);
    await user.click(screen.getByRole("button", { name: l.convert }));
    await user.click(screen.getByRole("button", { name: l.convertConfirm }));
    expect((await screen.findByRole("alert")).textContent).toBe(
      errorText(t, "some_server_code"),
    );
    expect(refresh).not.toHaveBeenCalled();
  });

  it("shows the unavailable text when the network fails", async () => {
    fetchMock.mockRejectedValue(new Error("network down"));
    const user = userEvent.setup();
    renderTable([makeRow({ deal_type: "sale", city_id: 5 })]);
    await user.click(screen.getByRole("button", { name: l.convert }));
    await user.click(screen.getByRole("button", { name: l.convertConfirm }));
    expect((await screen.findByRole("alert")).textContent).toBe(errorText(t, "unavailable"));
  });
});
