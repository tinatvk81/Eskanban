// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fa } from "@/i18n/messages/fa";
import type { VocabMap } from "@/lib/propertyTypes";
import { PropertyForm } from "./PropertyForm";

const router = vi.hoisted(() => ({ replace: vi.fn(), refresh: vi.fn(), push: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => router }));

vi.mock("next/link", async () => {
  const React = await import("react");
  return {
    default: ({ href, children, ...rest }: { href: string; children?: ReactNode }) =>
      React.createElement("a", { href, ...rest }, children),
  };
});

// The real picker keeps the city id in a hidden input named "city" and the district in "district".
vi.mock("@/components/CityAutocomplete", async () => {
  const React = await import("react");
  return {
    CityAutocomplete: () =>
      React.createElement(
        React.Fragment,
        null,
        React.createElement("input", { name: "city", "aria-label": "city-id" }),
        React.createElement("input", { name: "district", "aria-label": "district-text" }),
      ),
  };
});

const OWNER = "3f2b8c1e-5d4a-4b7e-9c1a-2f6d8e0a1b3c";

const vocab: VocabMap = {
  deal_types: [
    { key: "sale", fa: "فروش", en: "Sale" },
    { key: "rent", fa: "اجاره", en: "Rent" },
    { key: "presale", fa: "پیش‌فروش", en: "Presale" },
    { key: "mortgage", fa: "رهن", en: "Mortgage" },
  ],
  property_types: [{ key: "apartment", fa: "آپارتمان", en: "Apartment" }],
  amenities: [{ key: "elevator", fa: "آسانسور", en: "Elevator" }],
  directions: [{ key: "north", fa: "شمالی", en: "North" }],
  occupancy: [{ key: "vacant", fa: "خالی", en: "Vacant" }],
  document_types: [{ key: "official", fa: "سند رسمی", en: "Official deed" }],
  deed_scopes: [{ key: "land_only", fa: "فقط عرصه", en: "Land only" }],
  ownership_kinds: [{ key: "freehold", fa: "طلق", en: "Freehold" }],
};

const fetchMock = vi.fn();
const reply = (status: number, body: unknown) => ({
  ok: status >= 200 && status < 300,
  status,
  json: async () => body,
});

beforeEach(() => {
  fetchMock.mockReset();
  router.replace.mockReset();
  router.refresh.mockReset();
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

function renderForm(props: { isManager?: boolean; advisors?: Array<{ id: string; full_name: string }> } = {}) {
  return render(
    <PropertyForm
      locale="fa"
      t={fa}
      vocab={vocab}
      isManager={props.isManager ?? false}
      advisors={props.advisors ?? []}
    />,
  );
}

const field = (text: string) => screen.getByLabelText(text);
const submitButton = () => screen.getByRole("button", { name: fa.fileForm.submit });
const sentBody = () => JSON.parse(fetchMock.mock.calls[0][1].body as string);

async function fillRequired(user: ReturnType<typeof userEvent.setup>) {
  await user.selectOptions(field(fa.fileDetail.fields.dealType), "sale");
  await user.type(field("city-id"), "12");
}

describe("PropertyForm", () => {
  it("shows the deal type and hides the advisor choice for an advisor", () => {
    renderForm();
    expect(field(fa.fileDetail.fields.dealType)).toBeTruthy();
    expect(screen.queryByLabelText(fa.fileForm.assignTo)).toBeNull();
  });

  it("shows price fields for a sale and rent fields for a rental", async () => {
    const user = userEvent.setup();
    renderForm();
    const dealType = field(fa.fileDetail.fields.dealType);

    await user.selectOptions(dealType, "sale");
    expect(screen.queryByLabelText(fa.fileDetail.fields.price)).toBeTruthy();
    expect(screen.queryByLabelText(fa.fileDetail.fields.deposit)).toBeNull();

    await user.selectOptions(dealType, "rent");
    expect(screen.queryByLabelText(fa.fileDetail.fields.deposit)).toBeTruthy();
    expect(screen.queryByLabelText(fa.fileDetail.fields.price)).toBeNull();
  });

  it("blocks an empty submit and reports the two required fields", async () => {
    const user = userEvent.setup();
    renderForm();

    await user.click(submitButton());

    expect(fetchMock).not.toHaveBeenCalled();
    expect(screen.getAllByText(fa.fileForm.fieldErrors.required)).toHaveLength(2);
    expect(screen.getByText(fa.fileForm.fixErrors)).toBeTruthy();
  });

  it("creates the file and opens it", async () => {
    const user = userEvent.setup();
    fetchMock.mockResolvedValue(reply(201, { id: "new-id" }));
    renderForm();

    await fillRequired(user);
    await user.click(submitButton());

    await waitFor(() => expect(router.replace).toHaveBeenCalledWith("/fa/files/new-id"));
    expect(router.refresh).toHaveBeenCalled();
    expect(fetchMock).toHaveBeenCalledOnce();
    expect(fetchMock.mock.calls[0][0]).toBe("/api/properties");
    expect(fetchMock.mock.calls[0][1].method).toBe("POST");
    expect(sentBody()).toMatchObject({ deal_type: "sale", city_id: 12 });
  });

  it("converts Persian digits in the price", async () => {
    const user = userEvent.setup();
    fetchMock.mockResolvedValue(reply(201, { id: "x" }));
    renderForm();

    await fillRequired(user);
    await user.type(field(fa.fileDetail.fields.price), "۵٬۰۰۰٬۰۰۰");
    await user.click(submitButton());

    await waitFor(() => expect(fetchMock).toHaveBeenCalledOnce());
    expect(sentBody().price_total).toBe(5_000_000);
  });

  it("rejects an invalid price without calling the server", async () => {
    const user = userEvent.setup();
    renderForm();

    await fillRequired(user);
    await user.type(field(fa.fileDetail.fields.price), "abc");
    await user.click(submitButton());

    expect(fetchMock).not.toHaveBeenCalled();
    expect(screen.getByText(fa.fileForm.fieldErrors.invalid)).toBeTruthy();
  });

  it("opens a collapsed section that contains an error", async () => {
    const user = userEvent.setup();
    renderForm();
    const section = () => screen.getByText(fa.fileDetail.sections.space).closest("details");
    expect((section() as HTMLDetailsElement).open).toBe(false);

    await fillRequired(user);
    fireEvent.change(field(fa.fileDetail.fields.buildYear), { target: { value: "abc" } });
    await user.click(submitButton());

    expect(fetchMock).not.toHaveBeenCalled();
    expect((section() as HTMLDetailsElement).open).toBe(true);
  });

  it("lets a manager choose the responsible advisor", async () => {
    const user = userEvent.setup();
    fetchMock.mockResolvedValue(reply(201, { id: "x" }));
    renderForm({ isManager: true, advisors: [{ id: OWNER, full_name: "Ali" }] });

    await fillRequired(user);
    await user.selectOptions(field(fa.fileForm.assignTo), OWNER);
    await user.click(submitButton());

    await waitFor(() => expect(fetchMock).toHaveBeenCalledOnce());
    expect(sentBody().owner_user_id).toBe(OWNER);
  });

  it("shows the forbidden message and allows a retry", async () => {
    const user = userEvent.setup();
    fetchMock.mockResolvedValue(reply(403, { error: { code: "forbidden", message: "m" } }));
    renderForm();

    await fillRequired(user);
    await user.click(submitButton());

    expect(await screen.findByText(fa.errors.forbidden)).toBeTruthy();
    expect(router.replace).not.toHaveBeenCalled();
    expect(submitButton().hasAttribute("disabled")).toBe(false);
  });

  it("shows a generic message for a rejected body (422)", async () => {
    const user = userEvent.setup();
    fetchMock.mockResolvedValue(reply(422, { detail: [] }));
    renderForm();

    await fillRequired(user);
    await user.click(submitButton());

    expect(await screen.findByText(fa.fileForm.invalidInput)).toBeTruthy();
  });

  it("redirects to login when the session has ended (401)", async () => {
    const user = userEvent.setup();
    fetchMock.mockResolvedValue(reply(401, { error: { code: "not_authenticated", message: "m" } }));
    renderForm();

    await fillRequired(user);
    await user.click(submitButton());

    await waitFor(() => expect(router.replace).toHaveBeenCalledWith("/fa/login"));
  });

  it("shows the unavailable message when the network fails", async () => {
    const user = userEvent.setup();
    fetchMock.mockRejectedValue(new Error("offline"));
    renderForm();

    await fillRequired(user);
    await user.click(submitButton());

    expect(await screen.findByText(fa.errors.unavailable)).toBeTruthy();
    expect(submitButton().hasAttribute("disabled")).toBe(false);
  });

  it("disables the button while saving and sends only one request", async () => {
    const user = userEvent.setup();
    let finish!: (value: unknown) => void;
    fetchMock.mockReturnValue(new Promise((resolve) => (finish = resolve)));
    renderForm();

    await fillRequired(user);
    await user.click(submitButton());

    const busy = await screen.findByRole("button", { name: fa.fileForm.submitting });
    expect(busy.hasAttribute("disabled")).toBe(true);
    await user.click(busy);
    expect(fetchMock).toHaveBeenCalledOnce();

    finish(reply(201, { id: "x" }));
    await waitFor(() => expect(router.replace).toHaveBeenCalledWith("/fa/files/x"));
  });
});

describe("PropertyForm deal-type rules (match the backend _apply_deal_rules)", () => {
  async function pick(dealType: string) {
    const user = userEvent.setup();
    renderForm();
    await user.selectOptions(field(fa.fileDetail.fields.dealType), dealType);
  }
  const has = (label: string) => screen.queryByLabelText(label) !== null;
  const f = fa.fileDetail.fields;

  it("sale: no contract end, delivery date or payment terms", async () => {
    await pick("sale");
    expect(has(f.contractEnd)).toBe(false);
    expect(has(f.deliveryDate)).toBe(false);
    expect(has(f.paymentTerms)).toBe(false);
  });

  it("presale: delivery date and payment terms, no contract end", async () => {
    await pick("presale");
    expect(has(f.price)).toBe(true);
    expect(has(f.deliveryDate)).toBe(true);
    expect(has(f.paymentTerms)).toBe(true);
    expect(has(f.contractEnd)).toBe(false);
  });

  it("rent: deposit, monthly rent and contract end, no delivery fields", async () => {
    await pick("rent");
    expect(has(f.deposit)).toBe(true);
    expect(has(f.monthlyRent)).toBe(true);
    expect(has(f.contractEnd)).toBe(true);
    expect(has(f.deliveryDate)).toBe(false);
    expect(has(f.paymentTerms)).toBe(false);
  });

  it("mortgage: deposit and contract end, but no monthly rent", async () => {
    await pick("mortgage");
    expect(has(f.deposit)).toBe(true);
    expect(has(f.contractEnd)).toBe(true);
    expect(has(f.monthlyRent)).toBe(false);
  });
});

describe("PropertyForm error summary and deal-type pruning", () => {
  it("names the failing fields in the summary", async () => {
    const user = userEvent.setup();
    renderForm();
    await fillRequired(user);
    await user.type(field(fa.fileDetail.fields.price), "abc");
    await user.click(submitButton());

    const summary = screen
      .getAllByRole("alert")
      .find((el) => (el.textContent ?? "").includes(fa.fileForm.fixErrors));
    expect(summary?.textContent).toContain(fa.fileDetail.fields.price);
  });

  it("ignores a stale value typed under another deal type", async () => {
    const user = userEvent.setup();
    fetchMock.mockResolvedValue(reply(201, { id: "x" }));
    renderForm();
    const dealType = field(fa.fileDetail.fields.dealType);

    await user.selectOptions(dealType, "sale");
    await user.type(field(fa.fileDetail.fields.price), "abc");
    await user.selectOptions(dealType, "rent");
    await user.type(field("city-id"), "12");
    await user.click(submitButton());

    await waitFor(() => expect(fetchMock).toHaveBeenCalledOnce());
    expect(sentBody()).toMatchObject({ deal_type: "rent", city_id: 12 });
  });
});
