// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { EditLink } from "./EditLink";

vi.mock("next/link", () => ({
  default: ({ href, children }: { href: string; children?: ReactNode }) => (
    <a href={href}>{children}</a>
  ),
}));

const ID = "3f2b8c1e-5d4a-4b7e-9c1a-2e6f8a9b0c3d";

afterEach(cleanup);

describe("EditLink", () => {
  it("links to the edit page when the user can edit", () => {
    render(<EditLink locale="fa" id={ID} canEdit label="Edit" />);
    expect(screen.getByRole("link", { name: "Edit" }).getAttribute("href")).toBe(`/fa/files/${ID}/edit`);
  });

  it("renders nothing when the user cannot edit", () => {
    const { container } = render(<EditLink locale="fa" id={ID} canEdit={false} label="Edit" />);
    expect(container.innerHTML).toBe("");
  });

  it("uses the current locale in the link", () => {
    render(<EditLink locale="en" id={ID} canEdit label="Edit" />);
    expect(screen.getByRole("link").getAttribute("href")).toBe(`/en/files/${ID}/edit`);
  });
});
