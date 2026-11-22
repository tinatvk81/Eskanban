// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import DashboardPage from "./page";

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
  getMessages: (locale: string) => ({
    brand: "Eskanban",
    errors: {
      unavailable: "Service unavailable",
      generic: "Something went wrong",
      forbidden: "Forbidden",
      versionConflict: "Version conflict",
      notFound: "Not found",
      userNotFound: "User not found",
      invalidCredentials: "Invalid credentials",
      accountLocked: "Account locked",
      weakPassword: "Weak password",
      wrongPassword: "Wrong password",
    },
    dashboard: {
      welcome: locale === "fa" ? "خوش آمدید" : "Welcome",
      role: "Role",
      plan: "Plan",
      seats: "Seats",
      roles: { manager: "Manager", advisor: "Advisor" },
      plans: { solo: "Solo", small: "Small", large: "Large" },
      comingSoon: "Coming soon",
      statsTitle: locale === "fa" ? "آمار فایل‌های ملکی" : "Property statistics",
      totalActive: "Total active files",
      newThisWeek: "New this week",
      urgent: "Urgent",
      contractsOverdue: "Overdue",
      contractsEnding7Days: "Ending in 7 days",
      contractsEnding30Days: "Ending in 30 days",
      dealBreakdown: "By deal type",
      deals: { sale: "Sale", presale: "Pre-sale", rent: "Rent", mortgage: "Mortgage" },
      noActiveProperties: "No active properties",
    },
    auth: { logout: "Logout" },
    files: { title: "Property files" },
    theme: { toggle: "Theme", light: "Light", dark: "Dark" },
    language: { switchTo: "Switch language" },
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

const stats = {
  total_active: 25,
  by_deal_type: { sale: 10, presale: 3, rent: 8, mortgage: 4 },
  new_this_week: 5,
  urgent: 2,
  contracts_overdue: 1,
  contracts_ending_7_days: 3,
  contracts_ending_30_days: 6,
};

function signedIn(role: "manager" | "advisor" = "manager", mustChange = false) {
  mocks.getCurrentUser.mockResolvedValue({
    status: "ok",
    data: {
      user: {
        full_name: "Test User",
        role,
        must_change_password: mustChange,
      },
      agency: {
        name: "Test Agency",
        plan: "small",
        seat_limit: 10,
      },
    },
  });
}

async function renderPage(locale = "fa") {
  const ui = await DashboardPage({ params: Promise.resolve({ locale }) });
  return render(ui);
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.getSessionToken.mockResolvedValue("test-token");
  mocks.apiFetch.mockResolvedValue({ ok: true, status: 200, data: stats });
});

afterEach(() => cleanup());

describe("dashboard page", () => {
  it("returns 404 for an unknown locale", async () => {
    await expect(renderPage("xx")).rejects.toThrow("NOT_FOUND");
  });

  it("redirects unauthenticated users to login without requesting stats", async () => {
    mocks.getCurrentUser.mockResolvedValue({ status: "unauthenticated" });
    await expect(renderPage()).rejects.toThrow("REDIRECT:/fa/login");
    expect(mocks.apiFetch).not.toHaveBeenCalled();
  });

  it("redirects users who must change their password", async () => {
    signedIn("advisor", true);
    await expect(renderPage()).rejects.toThrow("REDIRECT:/fa/change-password");
    expect(mocks.apiFetch).not.toHaveBeenCalled();
  });

  it("shows the unavailable state when the current-user request fails", async () => {
    mocks.getCurrentUser.mockResolvedValue({ status: "unavailable" });
    await renderPage();
    expect(screen.getByRole("alert").textContent).toBe("Service unavailable");
    expect(mocks.apiFetch).not.toHaveBeenCalled();
  });

  it.each(["manager", "advisor"] as const)(
    "renders API statistics for a %s",
    async (role) => {
      signedIn(role);
      await renderPage();

      expect(mocks.apiFetch).toHaveBeenCalledWith(
        "/api/v1/properties/stats",
        { token: "test-token" },
      );
      expect(screen.getByText("Test Agency")).toBeTruthy();
      expect(
        screen.getByText(new Intl.NumberFormat("fa-IR").format(25)),
      ).toBeTruthy();

      expect(
        screen.getAllByText(new Intl.NumberFormat("fa-IR").format(10)).length,
      ).toBeGreaterThan(0);
      expect(screen.getByText("آمار فایل‌های ملکی")).toBeTruthy();
      expect(screen.getByRole("link", { name: "Property files" }).getAttribute("href"))
        .toBe("/fa/files");
    },
  );

  it("renders zero values as valid statistics and shows the empty message", async () => {
    signedIn();
    mocks.apiFetch.mockResolvedValue({
      ok: true,
      status: 200,
      data: {
        total_active: 0,
        by_deal_type: { sale: 0, presale: 0, rent: 0, mortgage: 0 },
        new_this_week: 0,
        urgent: 0,
        contracts_overdue: 0,
        contracts_ending_7_days: 0,
        contracts_ending_30_days: 0,
      },
    });

    await renderPage();

    expect(screen.getByText("No active properties")).toBeTruthy();
    expect(screen.getAllByText("۰").length).toBeGreaterThan(0);
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("redirects to login when the statistics API returns 401", async () => {
    signedIn();
    mocks.apiFetch.mockResolvedValue({
      ok: false,
      status: 401,
      error: { code: "unauthorized", message: "Unauthorized" },
      retryAfter: null,
    });

    await expect(renderPage()).rejects.toThrow("REDIRECT:/fa/login");
  });

  it("shows the unavailable message when the statistics API returns 503", async () => {
    signedIn();
    mocks.apiFetch.mockResolvedValue({
      ok: false,
      status: 503,
      error: { code: "unavailable", message: "Unavailable" },
      retryAfter: null,
    });

    await renderPage();

    expect(screen.getByRole("alert").textContent).toBe("Service unavailable");
    expect(screen.getByText("Test Agency")).toBeTruthy();
    expect(screen.getByRole("link", { name: "Property files" })).toBeTruthy();
  });

  it("shows a translated generic error for other statistics failures", async () => {
    signedIn();
    mocks.apiFetch.mockResolvedValue({
      ok: false,
      status: 500,
      error: { code: "internal_error", message: "Internal error" },
      retryAfter: null,
    });

    await renderPage();

    expect(screen.getByRole("alert").textContent).toBe("Something went wrong");
    expect(screen.getByText("Test Agency")).toBeTruthy();
  });

  it("renders the Persian dashboard heading for the Persian locale", async () => {
    signedIn();
    await renderPage("fa");
    expect(screen.getByText("آمار فایل‌های ملکی")).toBeTruthy();
  });

  it("requests the same statistics endpoint for the English locale", async () => {
    signedIn();
    await renderPage("en");
    expect(mocks.apiFetch).toHaveBeenCalledWith(
      "/api/v1/properties/stats",
      { token: "test-token" },
    );
    expect(screen.getByText("Property statistics")).toBeTruthy();
  });
});
