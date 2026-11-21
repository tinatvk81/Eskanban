// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import NewFilePage from "./page";

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
    fileForm: { title: "New property file", intro: "Intro text" },
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

vi.mock("@/components/PropertyForm", () => ({
  PropertyForm: (props: unknown) => {
    mocks.propertyForm(props);
    return <div data-testid="property-form" />;
  },
}));

const VOCAB = { deal_types: [{ key: "sale", fa: "فروش", en: "Sale" }] };

function signedIn(role: "manager" | "advisor", mustChange = false) {
  mocks.getCurrentUser.mockResolvedValue({
    status: "ok",
    data: { user: { role, must_change_password: mustChange } },
  });
}

function api(vocab: unknown, users: unknown = { ok: true, data: [] }) {
  mocks.apiFetch.mockImplementation(async (path: string) =>
    path === "/api/v1/vocab" ? vocab : users,
  );
}

async function renderPage(locale = "fa") {
  const ui = await NewFilePage({ params: Promise.resolve({ locale }) });
  return render(ui);
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.getSessionToken.mockResolvedValue("token-1");
});

afterEach(() => cleanup());

describe("files/new page", () => {
  it("returns 404 for an unknown locale", async () => {
    await expect(renderPage("xx")).rejects.toThrow("NOT_FOUND");
  });

  it("redirects to login when not signed in", async () => {
    mocks.getCurrentUser.mockResolvedValue({ status: "unauthenticated" });
    await expect(renderPage()).rejects.toThrow("REDIRECT:/fa/login");
  });

  it("redirects to change-password when the user must change it", async () => {
    signedIn("advisor", true);
    await expect(renderPage()).rejects.toThrow("REDIRECT:/fa/change-password");
  });

  it("shows the unavailable message and no form when the user lookup fails", async () => {
    mocks.getCurrentUser.mockResolvedValue({ status: "unavailable" });
    await renderPage();
    expect(screen.getByText("Service unavailable")).toBeTruthy();
    expect(screen.queryByTestId("property-form")).toBeNull();
  });

  it("renders the form for an advisor without loading the user list", async () => {
    signedIn("advisor");
    api({ ok: true, data: VOCAB });
    await renderPage();

    expect(screen.getByText("New property file")).toBeTruthy();
    expect(screen.getByTestId("property-form")).toBeTruthy();
    expect(mocks.apiFetch.mock.calls.map((c) => c[0])).toEqual(["/api/v1/vocab"]);
    expect(mocks.propertyForm.mock.calls[0][0]).toMatchObject({
      locale: "fa",
      isManager: false,
      advisors: [],
      vocab: VOCAB,
    });
  });

  it("gives a manager only the active users as advisors", async () => {
    signedIn("manager");
    api(
      { ok: true, data: VOCAB },
      {
        ok: true,
        data: [
          { id: "u1", full_name: "Ali", is_active: true },
          { id: "u2", full_name: "Sara", is_active: false },
        ],
      },
    );
    await renderPage();

    expect(mocks.apiFetch.mock.calls.map((c) => c[0]).sort()).toEqual([
      "/api/v1/users",
      "/api/v1/vocab",
    ]);
    expect(mocks.propertyForm.mock.calls[0][0]).toMatchObject({
      isManager: true,
      advisors: [{ id: "u1", full_name: "Ali" }],
    });
  });

  it("redirects to login when the vocab call returns 401", async () => {
    signedIn("advisor");
    api({ ok: false, status: 401 });
    await expect(renderPage()).rejects.toThrow("REDIRECT:/fa/login");
  });

  it("shows the unavailable message and no form when vocab fails otherwise", async () => {
    signedIn("advisor");
    api({ ok: false, status: 500 });
    await renderPage();
    expect(screen.getByText("Service unavailable")).toBeTruthy();
    expect(screen.queryByTestId("property-form")).toBeNull();
  });
});
