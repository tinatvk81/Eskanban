// @vitest-environment jsdom
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import * as faModule from "@/i18n/messages/fa";
import type { Messages } from "@/i18n/messages/types";
import { errorText } from "@/lib/errorText";
import { AddListingLinkForm } from "./AddListingLinkForm";

const { refresh, replace } = vi.hoisted(() => ({ refresh: vi.fn(), replace: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh, replace }) }));

const mod = faModule as unknown as Record<string, unknown>;
const t = (mod.default ?? mod.fa) as Messages;
if (!t) throw new Error("cannot find the fa messages export in @/i18n/messages/fa");
const l = t.listings;

const URL_OK = "https://divar.ir/v/abc";
const fetchMock = vi.fn();

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

describe("AddListingLinkForm", () => {
  it("disables the button until a link is typed", async () => {
    render(<AddListingLinkForm locale="fa" t={t} />);
    const button = screen.getByRole("button", { name: l.addButton }) as HTMLButtonElement;
    expect(button.disabled).toBe(true);
    await userEvent.setup().type(screen.getByLabelText(l.linkLabel), URL_OK);
    expect(button.disabled).toBe(false);
  });

  it("POSTs the url, clears the input, shows success and refreshes", async () => {
    fetchMock.mockResolvedValue({ ok: true, status: 201 });
    const user = userEvent.setup();
    render(<AddListingLinkForm locale="fa" t={t} />);
    const input = screen.getByLabelText(l.linkLabel) as HTMLInputElement;
    await user.type(input, URL_OK);
    await user.click(screen.getByRole("button", { name: l.addButton }));

    expect((await screen.findByRole("status")).textContent).toBe(l.added);
    expect(fetchMock.mock.calls[0][0]).toBe("/api/listings");
    expect(fetchMock.mock.calls[0][1].method).toBe("POST");
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual({ url: URL_OK });
    expect(input.value).toBe("");
    expect(refresh).toHaveBeenCalledTimes(1);
  });

  it("shows the mapped error text on a server error", async () => {
    fetchMock.mockResolvedValue({
      ok: false,
      status: 400,
      json: async () => ({ error: { code: "some_server_code" } }),
    });
    const user = userEvent.setup();
    render(<AddListingLinkForm locale="fa" t={t} />);
    await user.type(screen.getByLabelText(l.linkLabel), URL_OK);
    await user.click(screen.getByRole("button", { name: l.addButton }));
    expect((await screen.findByRole("alert")).textContent).toBe(errorText(t, "some_server_code"));
    expect(refresh).not.toHaveBeenCalled();
  });

  it("shows the unavailable text when the network fails", async () => {
    fetchMock.mockRejectedValue(new Error("network down"));
    const user = userEvent.setup();
    render(<AddListingLinkForm locale="fa" t={t} />);
    await user.type(screen.getByLabelText(l.linkLabel), URL_OK);
    await user.click(screen.getByRole("button", { name: l.addButton }));
    expect((await screen.findByRole("alert")).textContent).toBe(errorText(t, "unavailable"));
  });

  it("redirects to the locale login route on 401", async () => {
    fetchMock.mockResolvedValue({ ok: false, status: 401, json: async () => ({}) });
    const user = userEvent.setup();
    render(<AddListingLinkForm locale="fa" t={t} />);
    await user.type(screen.getByLabelText(l.linkLabel), URL_OK);
    await user.click(screen.getByRole("button", { name: l.addButton }));
    await waitFor(() => expect(replace).toHaveBeenCalledWith("/fa/login"));
  });
});
