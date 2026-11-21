// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CityAutocomplete } from "./CityAutocomplete";

const labels = {
  city: "شهر",
  district: "محله",
  cityPlaceholder: "جستجوی شهر",
  districtPlaceholder: "نام محله",
  citySearching: "در حال جستجو",
  cityNoResults: "نتیجه‌ای نیست",
  districtHint: "راهنما",
};

const CITIES = [{ id: 7, name: "مشهد", province_name: "خراسان رضوی" }];
const fetchMock = vi.fn();

beforeEach(() => {
  fetchMock.mockReset();
  fetchMock.mockImplementation(async (url: string) => ({
    ok: true,
    json: async () => (String(url).includes("/api/geo/cities") ? CITIES : []),
  }));
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

function setup() {
  const view = render(
    <form>
      <CityAutocomplete initialCity={null} initialDistrict="" labels={labels} />
    </form>,
  );
  const cityInput = view.container.querySelector('input:not([type="hidden"])') as HTMLInputElement;
  const hidden = () => view.container.querySelector('input[name="city"]') as HTMLInputElement;
  return { cityInput, hidden };
}

describe("CityAutocomplete selection (real component, no mock)", () => {
  it("puts the chosen city id into the hidden input", async () => {
    const user = userEvent.setup();
    const { cityInput, hidden } = setup();

    await user.type(cityInput, "مشهد");
    const option = await screen.findByRole("option", { name: /مشهد/ }, { timeout: 3000 });
    await user.click(option);

    expect(hidden().value).toBe("7");
    expect(cityInput.value).toContain("مشهد");
  });

  it("keeps the id after the follow-up requests settle", async () => {
    const user = userEvent.setup();
    const { cityInput, hidden } = setup();

    await user.type(cityInput, "مشهد");
    await user.click(await screen.findByRole("option", { name: /مشهد/ }, { timeout: 3000 }));
    await new Promise((resolve) => setTimeout(resolve, 800));

    expect(hidden().value).toBe("7");
  });
});
