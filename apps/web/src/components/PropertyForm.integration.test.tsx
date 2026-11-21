// @vitest-environment jsdom
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fa } from "@/i18n/messages/fa";
import type { VocabMap } from "@/lib/propertyTypes";
import { PropertyForm } from "./PropertyForm";

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

const vocab: VocabMap = {
  deal_types: [{ key: "sale", fa: "فروش", en: "Sale" }],
  property_types: [],
  amenities: [],
  directions: [],
  occupancy: [],
  document_types: [],
  deed_scopes: [],
  ownership_kinds: [],
};

const CITIES = [{ id: 514, name: "مشهد", province_id: 11, province_name: "خراسان رضوی" }];
const fetchMock = vi.fn();

beforeEach(() => {
  fetchMock.mockReset();
  router.replace.mockReset();
  router.refresh.mockReset();
  fetchMock.mockImplementation(async (url: string, init?: { method?: string }) => {
    const u = String(url);
    if (u.startsWith("/api/geo/cities")) return { ok: true, status: 200, json: async () => CITIES };
    if (u.startsWith("/api/geo/districts")) return { ok: true, status: 200, json: async () => [] };
    if (u === "/api/properties" && init?.method === "POST") {
      return { ok: true, status: 201, json: async () => ({ id: "new-id" }) };
    }
    return { ok: false, status: 404, json: async () => ({}) };
  });
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("PropertyForm with the real CityAutocomplete", () => {
  it("sends the chosen city id when the user picks a city and submits", async () => {
    const user = userEvent.setup();
    const { container } = render(
      <PropertyForm locale="fa" t={fa} vocab={vocab} isManager={false} advisors={[]} />,
    );

    await user.selectOptions(screen.getByLabelText(fa.fileDetail.fields.dealType), "sale");

    const hidden = container.querySelector('input[name="city"]') as HTMLInputElement;
    const cityInput = hidden.parentElement!.querySelector(
      'input:not([type="hidden"])',
    ) as HTMLInputElement;
    await user.type(cityInput, "مشهد");
    await user.click(await screen.findByRole("option", { name: /مشهد/ }, { timeout: 3000 }));
    expect(hidden.value).toBe("514");

    await user.click(screen.getByRole("button", { name: fa.fileForm.submit }));

    await waitFor(() => expect(router.replace).toHaveBeenCalledWith("/fa/files/new-id"));
    const post = fetchMock.mock.calls.find(
      (c) => c[0] === "/api/properties" && c[1]?.method === "POST",
    );
    expect(JSON.parse(post![1].body as string)).toMatchObject({ deal_type: "sale", city_id: 514 });
  });

  it("asks for the city when it was typed but not picked from the list", async () => {
    const user = userEvent.setup();
    const { container } = render(
      <PropertyForm locale="fa" t={fa} vocab={vocab} isManager={false} advisors={[]} />,
    );

    await user.selectOptions(screen.getByLabelText(fa.fileDetail.fields.dealType), "sale");
    const hidden = container.querySelector('input[name="city"]') as HTMLInputElement;
    const cityInput = hidden.parentElement!.querySelector(
      'input:not([type="hidden"])',
    ) as HTMLInputElement;
    await user.type(cityInput, "مشهد");
    await user.click(screen.getByRole("button", { name: fa.fileForm.submit }));

    expect(hidden.value).toBe("");
    expect(screen.getByText(fa.fileForm.fieldErrors.required)).toBeTruthy();
    const post = fetchMock.mock.calls.find((c) => c[1]?.method === "POST");
    expect(post).toBeUndefined();
  });
});
