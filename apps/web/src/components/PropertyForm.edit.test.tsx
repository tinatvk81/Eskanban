// @vitest-environment jsdom
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fa } from "@/i18n/messages/fa";
import { EMPTY_FORM } from "@/lib/propertyForm";
import type { VocabMap } from "@/lib/propertyTypes";
import { PropertyForm, type EditData } from "./PropertyForm";

// Only routing is mocked. CityAutocomplete is the REAL component.
const router = vi.hoisted(() => ({ replace: vi.fn(), refresh: vi.fn(), push: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => router }));
vi.mock("next/link", async () => {
  const React = await import("react");
  return {
    default: ({ href, children, ...rest }: { href: string; children?: ReactNode }) =>
      React.createElement("a", { href, ...rest }, children),
  };
});

const ID = "3f2b8c1e-5d4a-4b7e-9c1a-2e6f8a9b0c3d";

const vocab: VocabMap = {
  deal_types: [{ key: "rent", fa: "اجاره", en: "Rent" }],
  property_types: [],
  amenities: [],
  directions: [],
  occupancy: [],
  document_types: [],
  deed_scopes: [],
  ownership_kinds: [],
};

const edit: EditData = {
  id: ID,
  version: 4,
  values: {
    ...EMPTY_FORM,
    deal_type: "rent",
    city_id: "514",
    district: "سجاد",
    address: "وکیل‌آباد",
    deposit: "200000000",
    monthly_rent: "8000000",
  },
  convertibleOptions: [{ deposit: 100_000_000, monthly_rent: 12_000_000 }],
  city: { id: 514, name: "مشهد", province_id: 11, province_name: "خراسان رضوی" },
};

const fetchMock = vi.fn();
let putResult: { ok: boolean; status: number; body: unknown };

beforeEach(() => {
  fetchMock.mockReset();
  router.replace.mockReset();
  router.refresh.mockReset();
  putResult = { ok: true, status: 200, body: { id: ID, version: 5 } };
  fetchMock.mockImplementation(async (url: string, init?: { method?: string }) => {
    const u = String(url);
    if (u.startsWith("/api/geo/cities")) return { ok: true, status: 200, json: async () => [edit.city] };
    if (u.startsWith("/api/geo/districts")) return { ok: true, status: 200, json: async () => [] };
    if (u === `/api/properties/${ID}` && init?.method === "PUT") {
      return { ok: putResult.ok, status: putResult.status, json: async () => putResult.body };
    }
    return { ok: false, status: 404, json: async () => ({}) };
  });
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

const renderEdit = (props: { isManager?: boolean; advisors?: { id: string; full_name: string }[] } = {}) =>
  render(
    <PropertyForm
      locale="fa"
      t={fa}
      vocab={vocab}
      isManager={props.isManager ?? false}
      advisors={props.advisors ?? []}
      edit={edit}
    />,
  );

const puts = () => fetchMock.mock.calls.filter((c) => c[1]?.method === "PUT");

describe("PropertyForm in edit mode", () => {
  it("shows the loaded values, including the real city picker's id", () => {
    const { container } = renderEdit();
    expect((screen.getByLabelText(fa.fileDetail.fields.address) as HTMLInputElement).value).toBe("وکیل‌آباد");
    expect((screen.getByLabelText(fa.fileDetail.fields.deposit) as HTMLInputElement).value).toBe("200000000");
    expect((container.querySelector('input[name="city"]') as HTMLInputElement).value).toBe("514");
    expect(screen.getByRole("button", { name: fa.fileForm.save })).toBeTruthy();
  });

  it("saves without changes: PUT with the version, the city and the untouched convertible options", async () => {
    const user = userEvent.setup();
    renderEdit();

    await user.click(screen.getByRole("button", { name: fa.fileForm.save }));

    await waitFor(() => expect(router.replace).toHaveBeenCalledWith(`/fa/files/${ID}`));
    expect(puts()).toHaveLength(1);
    const body = JSON.parse(puts()[0][1].body as string);
    expect(body).toMatchObject({
      deal_type: "rent",
      city_id: 514,
      version: 4,
      deposit: 200_000_000,
      monthly_rent: 8_000_000,
      ownership_dang: 6,
      convertible_options: [{ deposit: 100_000_000, monthly_rent: 12_000_000 }],
    });
    expect(body).not.toHaveProperty("owner_user_id");
    expect(fetchMock.mock.calls.some((c) => c[1]?.method === "POST")).toBe(false);
  });

  it("does not offer to reassign the file, even to a manager", () => {
    renderEdit({ isManager: true, advisors: [{ id: "u1", full_name: "Ali" }] });
    expect(screen.queryByLabelText(fa.fileForm.assignTo)).toBeNull();
  });

  it("on a version conflict keeps what was typed, blocks saving and offers a reload", async () => {
    putResult = { ok: false, status: 409, body: { error: { code: "version_conflict" } } };
    const user = userEvent.setup();
    renderEdit();

    const address = screen.getByLabelText(fa.fileDetail.fields.address) as HTMLInputElement;
    await user.type(address, " ۲");
    await user.click(screen.getByRole("button", { name: fa.fileForm.save }));

    expect(await screen.findByText(fa.errors.versionConflict)).toBeTruthy();
    expect(address.value).toBe("وکیل‌آباد ۲");
    expect((screen.getByRole("button", { name: fa.fileForm.save }) as HTMLButtonElement).disabled).toBe(true);

    await user.click(screen.getByRole("button", { name: fa.fileForm.save }));
    expect(puts()).toHaveLength(1);
    expect(router.replace).not.toHaveBeenCalled();

    await user.click(screen.getByRole("button", { name: fa.fileForm.reloadLatest }));
    expect(router.refresh).toHaveBeenCalledTimes(1);
  });

  it("sends the user to login on 401", async () => {
    putResult = { ok: false, status: 401, body: { error: { code: "not_authenticated" } } };
    const user = userEvent.setup();
    renderEdit();

    await user.click(screen.getByRole("button", { name: fa.fileForm.save }));

    await waitFor(() => expect(router.replace).toHaveBeenCalledWith("/fa/login"));
  });
});
