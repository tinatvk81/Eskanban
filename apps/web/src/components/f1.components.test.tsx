// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { Messages } from "@/i18n/messages/types";
import type { PropertyDetail as Detail, HistoryEntry } from "@/lib/propertyTypes";
import { PropertyDetail } from "./PropertyDetail";
import { PropertyHistory } from "./PropertyHistory";
import { PropertyActions } from "./PropertyActions";

const { router } = vi.hoisted(() => ({
  router: { replace: vi.fn(), refresh: vi.fn() },
}));

vi.mock("next/navigation", () => ({
  useRouter: () => router,
}));

vi.mock("@/lib/errorText", () => ({
  errorText: () => "requestError",
}));

const labels = new Proxy({}, {
  get: (_target, key) => String(key),
});

const t = {
  fileDetail: {
    yes: "yes",
    no: "no",
    openMap: "openMap",
    ownerUnavailable: "ownerUnavailable",
    historyEmpty: "historyEmpty",
    historyUnavailable: "historyUnavailable",
    noChanges: "noChanges",
    dang: "dang {n}",
    fields: labels,
    sections: labels,
  },
  files: {
    urgent: "urgent",
    shared: "shared",
    favorite: "favorite",
    units: { million: " million", billion: " billion", toman: " Toman", meter: " m²" },
  },
  fileActions: labels,
  errors: labels,
} as unknown as Messages;

const property = (overrides: Record<string, unknown> = {}) => ({
  id: "property-1",
  property_types: [],
  deal_type: "sale",
  status: "active",
  city: { id: 1, name: "Mashhad", province_id: 1, province_name: "Razavi Khorasan" },
  district: null,
  owner: { id: "advisor-1", full_name: "Advisor One" },
  shared_with_agency: false,
  is_favorite: false,
  is_urgent_now: false,
  is_urgent: false,
  amenities: [],
  custom_amenities: [],
  location_url: null,
  owner_name: null,
  owner_phone: null,
  deal_date: null,
  urgent_until: null,
  address: null,
  land_area_m2: null,
  built_area_m2: null,
  rooms: null,
  floor: null,
  total_floors: null,
  total_units: null,
  build_year: null,
  direction: null,
  is_corner: false,
  document_type: null,
  document_note: null,
  ownership_dang: 1,
  is_divided: null,
  deed_scope: null,
  ownership_kind: null,
  occupancy: null,
  vacate_date: null,
  price_total: null,
  price_per_m2: null,
  deposit: null,
  monthly_rent: null,
  price_note: null,
  payment_terms: null,
  contract_end_date: null,
  delivery_date: null,
  review_due_at: null,
  last_confirmed_at: "2026-01-01T10:00:00Z",
  created_at: "2026-01-01T10:00:00Z",
  updated_at: "2026-01-01T10:00:00Z",
  notes: null,
  ...overrides,
}) as unknown as Detail;

const actionProps = (overrides: Record<string, unknown> = {}) => ({
  locale: "en" as const,
  t,
  propertyId: "property-1",
  status: "active",
  isFavorite: false,
  isShared: false,
  ownerId: "advisor-1",
  canEdit: false,
  isManager: false,
  statuses: [],
  advisors: [],
  ...overrides,
});

beforeEach(() => {
  router.replace.mockReset();
  router.refresh.mockReset();
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("PropertyDetail", () => {
  it("shows owner name and a telephone link when contact is available", () => {
    render(
      <PropertyDetail
        property={property({
          owner_name: "Property Owner",
          owner_phone: "+989121234567",
        })}
        vocab={{}}
        locale="en"
        t={t}
      />,
    );

    expect(screen.getByText("Property Owner")).toBeTruthy();
    expect(screen.getByRole("link", { name: "+989121234567" }).getAttribute("href"))
      .toMatch(/^tel:/);
  });

  it("shows the unavailable message when owner contact is absent", () => {
    render(
      <PropertyDetail
        property={property()}
        vocab={{}}
        locale="en"
        t={t}
      />,
    );

    expect(screen.getByText("ownerUnavailable")).toBeTruthy();
  });
});

describe("PropertyHistory", () => {
  it("shows the unavailable state when entries are null", () => {
    render(<PropertyHistory entries={null} locale="en" t={t} />);
    expect(screen.getByText("historyUnavailable")).toBeTruthy();
  });

  it("shows the empty state when there are no entries", () => {
    render(<PropertyHistory entries={[]} locale="en" t={t} />);
    expect(screen.getByText("historyEmpty")).toBeTruthy();
  });

  it("renders an event and its no-changes label", () => {
    const entries = [{
      id: "history-1",
      action: "created",
      user: { id: "user-1", full_name: "Advisor One" },
      changes: {},
      created_at: "2026-01-01T10:00:00Z",
    }] satisfies HistoryEntry[];

    render(<PropertyHistory entries={entries} locale="en" t={t} />);

    expect(screen.getByText("created")).toBeTruthy();
    expect(screen.getByText("Advisor One")).toBeTruthy();
    expect(screen.getByText("noChanges")).toBeTruthy();
  });
});

describe("PropertyActions", () => {
  it("shows only favorite action to an advisor without edit permission", () => {
    render(<PropertyActions {...actionProps()} />);

    expect(screen.getByRole("button", { name: "favoriteAdd" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: "shareOn" })).toBeNull();
    expect(screen.queryByRole("button", { name: "delete" })).toBeNull();
    expect(screen.queryByText("statusLabel")).toBeNull();
    expect(screen.queryByText("reassignLabel")).toBeNull();
  });

  it("shows manager actions and edit controls when permitted", () => {
    render(
      <PropertyActions
        {...actionProps({
          isManager: true,
          canEdit: true,
          statuses: [{ key: "active", fa: "فعال", en: "Active" }],
          advisors: [{ id: "advisor-2", full_name: "Advisor Two" }],
        })}
      />,
    );

    expect(screen.getByRole("button", { name: "shareOn" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "delete" })).toBeTruthy();
    expect(screen.getByText("statusLabel")).toBeTruthy();
    expect(screen.getByText("reassignLabel")).toBeTruthy();
  });

  it("sends favorite request and refreshes after success", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true });
    vi.stubGlobal("fetch", fetchMock);

    render(<PropertyActions {...actionProps()} />);
    fireEvent.click(screen.getByRole("button", { name: "favoriteAdd" }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith(
      "/api/properties/property-1/favorite",
      expect.objectContaining({ method: "POST" }),
    ));
    await waitFor(() => expect(router.refresh).toHaveBeenCalledOnce());
    expect(await screen.findByText("done")).toBeTruthy();
  });

  it("shows an error when the request fails", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("network")));

    render(<PropertyActions {...actionProps()} />);
    fireEvent.click(screen.getByRole("button", { name: "favoriteAdd" }));

    expect((await screen.findByRole("alert")).textContent).toContain("requestError");
    expect(router.refresh).not.toHaveBeenCalled();
  });

  it("requires confirmation before manager can delete a property", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true });
    vi.stubGlobal("fetch", fetchMock);

    render(<PropertyActions {...actionProps({ isManager: true })} />);

    fireEvent.click(screen.getByRole("button", { name: "delete" }));
    expect(screen.getByText("deleteConfirm")).toBeTruthy();
    expect(fetchMock).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: "deleteYes" }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith(
      "/api/properties/property-1/soft-delete",
      expect.objectContaining({ method: "POST" }),
    ));
    await waitFor(() => expect(router.replace).toHaveBeenCalledWith("/en/files"));
  });
});

describe("PropertyActions additional behavior", () => {
  it("redirects to login when the backend returns 401", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        status: 401,
        json: async () => ({ error: { code: "not_authenticated" } }),
      }),
    );

    render(<PropertyActions {...actionProps()} />);
    fireEvent.click(screen.getByRole("button", { name: "favoriteAdd" }));

    await waitFor(() => {
      expect(router.replace).toHaveBeenCalledWith("/en/login");
    });
    expect(router.refresh).not.toHaveBeenCalled();
  });

  it("disables actions and shows the busy state while a request is pending", async () => {
    let resolveFetch!: (value: { ok: boolean }) => void;
    const pendingRequest = new Promise<{ ok: boolean }>((resolve) => {
      resolveFetch = resolve;
    });
    const fetchMock = vi.fn().mockReturnValue(pendingRequest);
    vi.stubGlobal("fetch", fetchMock);

    render(<PropertyActions {...actionProps({ isManager: true })} />);
    const favoriteButton = screen.getByRole("button", { name: "favoriteAdd" });

    fireEvent.click(favoriteButton);

    expect(favoriteButton.hasAttribute("disabled")).toBe(true);
    expect(screen.getByRole("status").textContent).toContain("working");

    resolveFetch({ ok: true });

    await waitFor(() => {
      expect(router.refresh).toHaveBeenCalledOnce();
    });
    expect(favoriteButton.hasAttribute("disabled")).toBe(false);
  });

  it("sends the selected status and deal date", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true });
    vi.stubGlobal("fetch", fetchMock);

    render(
      <PropertyActions
        {...actionProps({
          canEdit: true,
          statuses: [
            { key: "active", fa: "فعال", en: "Active" },
            { key: "closed", fa: "بسته", en: "Closed" },
          ],
        })}
      />,
    );

    fireEvent.change(screen.getByLabelText("statusLabel"), {
      target: { value: "closed" },
    });
    fireEvent.change(screen.getByLabelText("dealDate"), {
      target: { value: "2026-11-20" },
    });
    fireEvent.click(screen.getByRole("button", { name: "statusSave" }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        "/api/properties/property-1/status",
        expect.objectContaining({
          method: "POST",
          body: JSON.stringify({
            status: "closed",
            deal_date: "2026-11-20",
          }),
        }),
      );
    });
    await waitFor(() => expect(router.refresh).toHaveBeenCalledOnce());
    expect(await screen.findByText("done")).toBeTruthy();
  });

  it("sends the inverse shared state when the manager toggles sharing", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true });
    vi.stubGlobal("fetch", fetchMock);

    render(
      <PropertyActions
        {...actionProps({ isManager: true, isShared: false })}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "shareOn" }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        "/api/properties/property-1/share",
        expect.objectContaining({
          method: "POST",
          body: JSON.stringify({ shared: true }),
        }),
      );
    });
    await waitFor(() => expect(router.refresh).toHaveBeenCalledOnce());
    expect(await screen.findByText("done")).toBeTruthy();
  });

  it("sends the selected advisor ID when the manager reassigns a property", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true });
    vi.stubGlobal("fetch", fetchMock);

    render(
      <PropertyActions
        {...actionProps({
          isManager: true,
          ownerId: "advisor-1",
          advisors: [
            { id: "advisor-1", full_name: "Advisor One" },
            { id: "advisor-2", full_name: "Advisor Two" },
          ],
        })}
      />,
    );

    fireEvent.change(screen.getByLabelText("reassignLabel"), {
      target: { value: "advisor-2" },
    });
    fireEvent.click(screen.getByRole("button", { name: "reassignSave" }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        "/api/properties/property-1/reassign",
        expect.objectContaining({
          method: "POST",
          body: JSON.stringify({ owner_user_id: "advisor-2" }),
        }),
      );
    });
    await waitFor(() => expect(router.refresh).toHaveBeenCalledOnce());
    expect(await screen.findByText("done")).toBeTruthy();
  });
});


describe("PropertyActions edge cases", () => {
  it("shows an error for a non-401 HTTP failure without refreshing", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      status: 403,
      json: async () => ({ error: { code: "forbidden" } }),
    });
    vi.stubGlobal("fetch", fetchMock);

    render(<PropertyActions {...actionProps()} />);
    fireEvent.click(screen.getByRole("button", { name: "favoriteAdd" }));

    expect((await screen.findByRole("alert")).textContent).toContain("requestError");
    expect(router.refresh).not.toHaveBeenCalled();
    expect(router.replace).not.toHaveBeenCalled();
  });

  it("does not send a delete request when the manager cancels confirmation", () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    render(<PropertyActions {...actionProps({ isManager: true })} />);

    fireEvent.click(screen.getByRole("button", { name: "delete" }));
    expect(screen.getByText("deleteConfirm")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "cancel" }));

    expect(screen.queryByText("deleteConfirm")).toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
    expect(router.replace).not.toHaveBeenCalled();
  });

  it("shows an error and stays on the page when soft-delete fails", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      status: 500,
      json: async () => ({ error: { code: "generic" } }),
    });
    vi.stubGlobal("fetch", fetchMock);

    render(<PropertyActions {...actionProps({ isManager: true })} />);

    fireEvent.click(screen.getByRole("button", { name: "delete" }));
    fireEvent.click(screen.getByRole("button", { name: "deleteYes" }));

    expect((await screen.findByRole("alert")).textContent).toContain("requestError");
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/properties/property-1/soft-delete",
      expect.objectContaining({ method: "POST" }),
    );
    expect(router.replace).not.toHaveBeenCalled();
    expect(router.refresh).not.toHaveBeenCalled();
  });

  it("sends a null deal date when changing to a non-closed status", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true });
    vi.stubGlobal("fetch", fetchMock);

    render(
      <PropertyActions
        {...actionProps({
          canEdit: true,
          statuses: [
            { key: "active", fa: "فعال", en: "Active" },
            { key: "inactive", fa: "غیرفعال", en: "Inactive" },
          ],
        })}
      />,
    );

    fireEvent.change(screen.getByLabelText("statusLabel"), {
      target: { value: "inactive" },
    });
    fireEvent.click(screen.getByRole("button", { name: "statusSave" }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        "/api/properties/property-1/status",
        expect.objectContaining({
          method: "POST",
          body: JSON.stringify({
            status: "inactive",
            deal_date: null,
          }),
        }),
      );
    });
    await waitFor(() => expect(router.refresh).toHaveBeenCalledOnce());
  });

  it("disables status submission when the selected status is unchanged", () => {
    render(
      <PropertyActions
        {...actionProps({
          canEdit: true,
          status: "active",
          statuses: [
            { key: "active", fa: "فعال", en: "Active" },
            { key: "inactive", fa: "غیرفعال", en: "Inactive" },
          ],
        })}
      />,
    );

    expect(screen.getByRole("button", { name: "statusSave" }).hasAttribute("disabled"))
      .toBe(true);
  });

  it("disables reassignment when the selected advisor is already the owner", () => {
    render(
      <PropertyActions
        {...actionProps({
          isManager: true,
          ownerId: "advisor-1",
          advisors: [
            { id: "advisor-1", full_name: "Advisor One" },
            { id: "advisor-2", full_name: "Advisor Two" },
          ],
        })}
      />,
    );

    expect(screen.getByRole("button", { name: "reassignSave" }).hasAttribute("disabled"))
      .toBe(true);
  });

  it("allows an advisor with edit permission to change status but not manager-only actions", () => {
    render(
      <PropertyActions
        {...actionProps({
          isManager: false,
          canEdit: true,
          statuses: [
            { key: "active", fa: "فعال", en: "Active" },
            { key: "inactive", fa: "غیرفعال", en: "Inactive" },
          ],
          advisors: [{ id: "advisor-2", full_name: "Advisor Two" }],
        })}
      />,
    );

    expect(screen.getByText("statusLabel")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "shareOn" })).toBeNull();
    expect(screen.queryByRole("button", { name: "delete" })).toBeNull();
    expect(screen.queryByText("reassignLabel")).toBeNull();
  });

  it("shows manager-only actions without status editing when canEdit is false", () => {
    render(
      <PropertyActions
        {...actionProps({
          isManager: true,
          canEdit: false,
          statuses: [
            { key: "active", fa: "فعال", en: "Active" },
            { key: "inactive", fa: "غیرفعال", en: "Inactive" },
          ],
          advisors: [{ id: "advisor-2", full_name: "Advisor Two" }],
        })}
      />,
    );

    expect(screen.getByRole("button", { name: "shareOn" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "delete" })).toBeTruthy();
    expect(screen.getByText("reassignLabel")).toBeTruthy();
    expect(screen.queryByText("statusLabel")).toBeNull();
  });
});
