// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";

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
  propertyDetail: vi.fn(),
  propertyActions: vi.fn(),
  propertyHistory: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  redirect: mocks.redirect,
  notFound: mocks.notFound,
}));

vi.mock("@/lib/session", () => ({
  getCurrentUser: mocks.getCurrentUser,
  getSessionToken: mocks.getSessionToken,
}));

vi.mock("@/lib/api", () => ({
  apiFetch: mocks.apiFetch,
}));

vi.mock("@/i18n/getMessages", () => ({
  getMessages: () => ({
    errors: { unavailable: "Service unavailable" },
    fileDetail: { back: "Back" },
    auth: { logout: "Logout" },
  }),
}));

vi.mock("@/components/Topbar", () => ({
  Topbar: ({ children }: { children?: import("react").ReactNode }) => (
    <>
      <div data-testid="topbar" />
      {children}
    </>
  ),
}));

vi.mock("@/components/LogoutButton", () => ({
  LogoutButton: () => <div data-testid="logout-button" />,
}));

vi.mock("@/components/PropertyDetail", () => ({
  PropertyDetail: (props: unknown) => {
    mocks.propertyDetail(props);
    return <div data-testid="property-detail" />;
  },
}));

vi.mock("@/components/PropertyActions", () => ({
  PropertyActions: (props: unknown) => {
    mocks.propertyActions(props);
    return <div data-testid="property-actions" />;
  },
}));

vi.mock("@/components/PropertyHistory", () => ({
  PropertyHistory: (props: unknown) => {
    mocks.propertyHistory(props);
    return <div data-testid="property-history" />;
  },
}));

vi.mock("@/styles/files.css", () => ({}));

import FileDetailPage from "./page";

const propertyId = "11111111-1111-4111-8111-111111111111";
const advisorId = "22222222-2222-4222-8222-222222222222";
const managerId = "33333333-3333-4333-8333-333333333333";

const property = {
  id: propertyId,
  status: "active",
  is_favorite: false,
  shared_with_agency: false,
  owner: { id: advisorId },
  can_edit: true,
};

const activeAdvisor = {
  id: advisorId,
  full_name: "Active Advisor",
  phone: "09120000000",
  email: null,
  role: "advisor" as const,
  is_active: true,
  must_change_password: false,
};

const inactiveAdvisor = {
  ...activeAdvisor,
  id: "44444444-4444-4444-8444-444444444444",
  full_name: "Inactive Advisor",
  is_active: false,
};

function makeCurrentUser(
  role: "manager" | "advisor" = "manager",
  mustChangePassword = false,
) {
  return {
    status: "ok",
    data: {
      user: {
        id: role === "manager" ? managerId : advisorId,
        full_name: role === "manager" ? "Manager" : "Advisor",
        phone: "09120000000",
        email: null,
        role,
        is_active: true,
        must_change_password: mustChangePassword,
      },
      agency: {},
    },
  };
}

function success<T>(data: T) {
  return {
    ok: true,
    status: 200,
    data,
    retryAfter: null,
  };
}

function failure(status: number, code = "UNAVAILABLE") {
  return {
    ok: false,
    status,
    error: { code },
    retryAfter: null,
  };
}

function setupApi(options?: {
  propertyResult?: ReturnType<typeof success> | ReturnType<typeof failure>;
  historyResult?: ReturnType<typeof success> | ReturnType<typeof failure>;
  vocabResult?: ReturnType<typeof success> | ReturnType<typeof failure>;
  usersResult?: ReturnType<typeof success> | ReturnType<typeof failure>;
}) {
  const results = {
    propertyResult: options?.propertyResult ?? success(property),
    historyResult: options?.historyResult ?? success([]),
    vocabResult: options?.vocabResult ?? success({}),
    usersResult: options?.usersResult
      ?? success([activeAdvisor, inactiveAdvisor]),
  };

  mocks.apiFetch.mockImplementation((path: string) => {
    if (path === `/api/v1/properties/${propertyId}/history`) {
      return Promise.resolve(results.historyResult);
    }

    if (path === "/api/v1/vocab") {
      return Promise.resolve(results.vocabResult);
    }

    if (path === "/api/v1/users") {
      return Promise.resolve(results.usersResult);
    }

    if (path === `/api/v1/properties/${propertyId}`) {
      return Promise.resolve(results.propertyResult);
    }

    throw new Error(`Unexpected API request: ${path}`);
  });
}

function renderPage(locale = "fa") {
  return FileDetailPage({
    params: Promise.resolve({ locale, id: propertyId }),
  });
}

describe("FileDetailPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    mocks.getCurrentUser.mockResolvedValue(makeCurrentUser("manager"));
    mocks.getSessionToken.mockResolvedValue("test-session-token");

    setupApi();
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it("redirects unauthenticated users to login", async () => {
    mocks.getCurrentUser.mockResolvedValue({
      status: "unauthenticated",
    });

    await expect(renderPage()).rejects.toThrow("REDIRECT:/fa/login");

    expect(mocks.apiFetch).not.toHaveBeenCalled();
  });

  it("redirects users who must change their password", async () => {
    mocks.getCurrentUser.mockResolvedValue(
      makeCurrentUser("advisor", true),
    );

    await expect(renderPage()).rejects.toThrow(
      "REDIRECT:/fa/change-password",
    );

    expect(mocks.apiFetch).not.toHaveBeenCalled();
  });

  it("renders the detail page for a Manager and passes only active advisors", async () => {
    const page = await renderPage();

    render(page);

    expect(screen.getByTestId("topbar")).toBeTruthy();
    expect(screen.getByTestId("logout-button")).toBeTruthy();
    expect(screen.getByTestId("property-detail")).toBeTruthy();
    expect(screen.getByTestId("property-actions")).toBeTruthy();
    expect(screen.getByTestId("property-history")).toBeTruthy();

    expect(mocks.apiFetch).toHaveBeenCalledWith(
      "/api/v1/users",
      { token: "test-session-token" },
    );

    const actionsProps = mocks.propertyActions.mock.calls[0][0] as {
      isManager: boolean;
      advisors: Array<{ id: string; full_name: string }>;
    };

    expect(actionsProps.isManager).toBe(true);
    expect(actionsProps.advisors).toEqual([
      { id: advisorId, full_name: "Active Advisor" },
    ]);
  });

  it("does not request agency users for an Advisor", async () => {
    mocks.getCurrentUser.mockResolvedValue(makeCurrentUser("advisor"));

    const page = await renderPage();
    render(page);

    expect(mocks.apiFetch).not.toHaveBeenCalledWith(
      "/api/v1/users",
      expect.anything(),
    );

    const actionsProps = mocks.propertyActions.mock.calls[0][0] as {
      isManager: boolean;
      advisors: unknown[];
    };

    expect(actionsProps.isManager).toBe(false);
    expect(actionsProps.advisors).toEqual([]);
  });

  it("keeps the detail page available when history loading fails", async () => {
    setupApi({
      historyResult: failure(503),
    });

    const page = await renderPage();
    render(page);

    expect(screen.getByTestId("property-detail")).toBeTruthy();
    expect(screen.getByTestId("property-actions")).toBeTruthy();
    expect(screen.getByTestId("property-history")).toBeTruthy();

    const historyProps = mocks.propertyHistory.mock.calls[0][0] as {
      entries: unknown;
    };

    expect(historyProps.entries).toBeNull();
  });

  it("passes an empty history array when the API returns no entries", async () => {
    setupApi({
      historyResult: success([]),
    });

    const page = await renderPage();
    render(page);

    const historyProps = mocks.propertyHistory.mock.calls[0][0] as {
      entries: unknown[];
    };

    expect(historyProps.entries).toEqual([]);
  });

  it("shows an unavailable message when the property API returns 503", async () => {
    setupApi({
      propertyResult: failure(503),
    });

    const page = await renderPage();
    render(page);

    expect(screen.getByRole("alert").textContent).toBe(
      "Service unavailable",
    );

    expect(screen.queryByTestId("property-detail")).toBeNull();
    expect(screen.queryByTestId("property-actions")).toBeNull();
    expect(screen.queryByTestId("property-history")).toBeNull();
  });

  it("redirects to login when the property API returns 401", async () => {
    setupApi({
      propertyResult: failure(401),
    });

    await expect(renderPage()).rejects.toThrow("REDIRECT:/fa/login");
  });

  it("calls notFound when the property API returns 404", async () => {
    setupApi({
      propertyResult: failure(404),
    });

    await expect(renderPage()).rejects.toThrow("NOT_FOUND");
    expect(mocks.notFound).toHaveBeenCalledOnce();
  });

  it("renders an unavailable page when the current-user API is unavailable", async () => {
    mocks.getCurrentUser.mockResolvedValue({
      status: "unavailable",
    });

    const page = await renderPage();
    render(page);

    expect(screen.getByRole("alert").textContent).toBe(
      "Service unavailable",
    );

    expect(mocks.apiFetch).not.toHaveBeenCalled();
  });
});
