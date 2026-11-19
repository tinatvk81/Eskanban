
"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";

type City = {
  id: number;
  name: string;
  province_id: number;
  province_name: string;
};

type Props = {
  initialCity: City | null;
  initialDistrict: string;
  labels: {
    city: string;
    district: string;
    cityPlaceholder: string;
    districtPlaceholder: string;
    citySearching: string;
    cityNoResults: string;
    districtHint: string;
  };
};

const CITY_PAGE_SIZE = 30;
const DISTRICT_PAGE_SIZE = 20;
const DEBOUNCE_MS = 250;

export function CityAutocomplete({
  initialCity,
  initialDistrict,
  labels,
}: Props) {
  // City state
  const [cityText, setCityText] = useState(
    initialCity
      ? `${initialCity.name}، ${initialCity.province_name}`
      : "",
  );
  const [cityId, setCityId] = useState<number | null>(
    initialCity?.id ?? null,
  );
  const [cities, setCities] = useState<City[]>([]);
  const [cityOpen, setCityOpen] = useState(false);
  const [cityLoading, setCityLoading] = useState(false);
  const [cityLoadingMore, setCityLoadingMore] = useState(false);
  const [cityActiveIndex, setCityActiveIndex] = useState(-1);

  // District state
  const [district, setDistrict] = useState(initialDistrict);
  const [districts, setDistricts] = useState<string[]>([]);
  const [districtOpen, setDistrictOpen] = useState(false);
  const [districtLoading, setDistrictLoading] = useState(false);
  const [districtLoadingMore, setDistrictLoadingMore] = useState(false);
  const [districtActiveIndex, setDistrictActiveIndex] = useState(-1);

  // DOM references
  const cityContainerRef = useRef<HTMLDivElement>(null);
  const districtContainerRef = useRef<HTMLDivElement>(null);
  const cityListRef = useRef<HTMLDivElement>(null);
  const districtListRef = useRef<HTMLDivElement>(null);

  // Request references
  const cityAbortRef = useRef<AbortController | null>(null);
  const districtAbortRef = useRef<AbortController | null>(null);

  const cityRequestIdRef = useRef(0);
  const districtRequestIdRef = useRef(0);

  const cityOffsetRef = useRef(0);
  const districtOffsetRef = useRef(0);

  const cityHasMoreRef = useRef(true);
  const districtHasMoreRef = useRef(true);

  const cityLoadingMoreRef = useRef(false);
  const districtLoadingMoreRef = useRef(false);

  // When a city is selected, opening the dropdown shows all cities.
  // Typing after selection starts a new search.
  const cityQuery = cityId !== null ? "" : cityText.trim();
  const districtQuery = district.trim();

  const fetchCities = useCallback(
    async (reset = false) => {
      if (!reset) {
        if (
          cityLoadingMoreRef.current ||
          !cityHasMoreRef.current
        ) {
          return;
        }
      }

      let controller: AbortController;
      let requestId: number;
      let offset: number;

      if (reset) {
        cityAbortRef.current?.abort();

        controller = new AbortController();
        cityAbortRef.current = controller;

        requestId = ++cityRequestIdRef.current;
        offset = 0;

        cityOffsetRef.current = 0;
        cityHasMoreRef.current = true;
        cityLoadingMoreRef.current = false;

        setCities([]);
        setCityActiveIndex(-1);
        setCityLoading(true);
        setCityLoadingMore(false);
      } else {
        controller = cityAbortRef.current ?? new AbortController();
        cityAbortRef.current = controller;

        requestId = cityRequestIdRef.current;
        offset = cityOffsetRef.current;

        cityLoadingMoreRef.current = true;
        setCityLoadingMore(true);
      }

      try {
        const params = new URLSearchParams({
          limit: String(CITY_PAGE_SIZE),
          offset: String(offset),
        });

        if (cityQuery) {
          params.set("q", cityQuery);
        }

        const response = await fetch(
          `/api/geo/cities?${params.toString()}`,
          {
            method: "GET",
            cache: "no-store",
            signal: controller.signal,
          },
        );

        if (!response.ok) {
          if (requestId === cityRequestIdRef.current) {
            cityHasMoreRef.current = false;
          }
          return;
        }

        const data: City[] = await response.json();

        if (requestId !== cityRequestIdRef.current) {
          return;
        }

        const results = Array.isArray(data) ? data : [];

        if (reset) {
          setCities(results);
        } else {
          setCities((previous) => {
            const existingIds = new Set(
              previous.map((city) => city.id),
            );

            return [
              ...previous,
              ...results.filter(
                (city) => !existingIds.has(city.id),
              ),
            ];
          });
        }

        cityOffsetRef.current = offset + results.length;
        cityHasMoreRef.current =
          results.length === CITY_PAGE_SIZE;
      } catch (error) {
        if (
          !(error instanceof DOMException &&
            error.name === "AbortError")
        ) {
          cityHasMoreRef.current = false;
        }
      } finally {
        if (requestId === cityRequestIdRef.current) {
          if (reset) {
            setCityLoading(false);
          } else {
            cityLoadingMoreRef.current = false;
            setCityLoadingMore(false);
          }
        }
      }
    },
    [cityQuery],
  );

  const fetchDistricts = useCallback(
    async (reset = false) => {
      if (cityId === null) {
        return;
      }

      if (!reset) {
        if (
          districtLoadingMoreRef.current ||
          !districtHasMoreRef.current
        ) {
          return;
        }
      }

      let controller: AbortController;
      let requestId: number;
      let offset: number;

      if (reset) {
        districtAbortRef.current?.abort();

        controller = new AbortController();
        districtAbortRef.current = controller;

        requestId = ++districtRequestIdRef.current;
        offset = 0;

        districtOffsetRef.current = 0;
        districtHasMoreRef.current = true;
        districtLoadingMoreRef.current = false;

        setDistricts([]);
        setDistrictActiveIndex(-1);
        setDistrictLoading(true);
        setDistrictLoadingMore(false);
      } else {
        controller =
          districtAbortRef.current ?? new AbortController();

        districtAbortRef.current = controller;

        requestId = districtRequestIdRef.current;
        offset = districtOffsetRef.current;

        districtLoadingMoreRef.current = true;
        setDistrictLoadingMore(true);
      }

      try {
        const params = new URLSearchParams({
          city_id: String(cityId),
          limit: String(DISTRICT_PAGE_SIZE),
          offset: String(offset),
        });

        if (districtQuery) {
          params.set("q", districtQuery);
        }

        const response = await fetch(
          `/api/geo/districts?${params.toString()}`,
          {
            method: "GET",
            cache: "no-store",
            signal: controller.signal,
          },
        );

        if (!response.ok) {
          if (requestId === districtRequestIdRef.current) {
            districtHasMoreRef.current = false;
          }
          return;
        }

        const data: string[] = await response.json();

        if (requestId !== districtRequestIdRef.current) {
          return;
        }

        const results = Array.isArray(data) ? data : [];

        if (reset) {
          setDistricts(results);
        } else {
          setDistricts((previous) => {
            const existing = new Set(previous);

            return [
              ...previous,
              ...results.filter((item) => !existing.has(item)),
            ];
          });
        }

        districtOffsetRef.current = offset + results.length;
        districtHasMoreRef.current =
          results.length === DISTRICT_PAGE_SIZE;
      } catch (error) {
        if (
          !(error instanceof DOMException &&
            error.name === "AbortError")
        ) {
          districtHasMoreRef.current = false;
        }
      } finally {
        if (requestId === districtRequestIdRef.current) {
          if (reset) {
            setDistrictLoading(false);
          } else {
            districtLoadingMoreRef.current = false;
            setDistrictLoadingMore(false);
          }
        }
      }
    },
    [cityId, districtQuery],
  );

  // Fetch the first city page when the dropdown opens or the query changes.
  useEffect(() => {
    if (!cityOpen) {
      return;
    }

    const timer = window.setTimeout(() => {
      void fetchCities(true);
    }, cityQuery ? DEBOUNCE_MS : 0);

    return () => {
      window.clearTimeout(timer);
      cityAbortRef.current?.abort();
      cityRequestIdRef.current += 1;
    };
  }, [cityOpen, cityQuery, fetchCities]);

  // Fetch the first district page when its dropdown opens or query changes.
  useEffect(() => {
    if (!districtOpen || cityId === null) {
      return;
    }

    const timer = window.setTimeout(() => {
      void fetchDistricts(true);
    }, districtQuery ? DEBOUNCE_MS : 0);

    return () => {
      window.clearTimeout(timer);
      districtAbortRef.current?.abort();
      districtRequestIdRef.current += 1;
    };
  }, [districtOpen, cityId, districtQuery, fetchDistricts]);

  // Close dropdowns when clicking outside both fields.
  useEffect(() => {
    function handleOutsidePointer(event: PointerEvent) {
      const target = event.target;

      if (!(target instanceof Node)) {
        return;
      }

      if (
        cityContainerRef.current?.contains(target) ||
        districtContainerRef.current?.contains(target)
      ) {
        return;
      }

      setCityOpen(false);
      setDistrictOpen(false);
    }

    document.addEventListener(
      "pointerdown",
      handleOutsidePointer,
    );

    return () => {
      document.removeEventListener(
        "pointerdown",
        handleOutsidePointer,
      );
    };
  }, []);

  // Keep the active keyboard option visible while navigating.
  useEffect(() => {
    if (cityActiveIndex >= 0) {
      document
        .getElementById(`files-city-option-${cityActiveIndex}`)
        ?.scrollIntoView({ block: "nearest" });
    }
  }, [cityActiveIndex]);

  useEffect(() => {
    if (districtActiveIndex >= 0) {
      document
        .getElementById(
          `files-district-option-${districtActiveIndex}`,
        )
        ?.scrollIntoView({ block: "nearest" });
    }
  }, [districtActiveIndex]);

  function handleCityChange(value: string) {
    setCityText(value);
    setCityId(null);

    setDistrict("");
    setDistricts([]);
    setDistrictOpen(false);

    setCityOpen(true);
    setCityActiveIndex(-1);
  }

  function selectCity(city: City) {
    setCityText(`${city.name}، ${city.province_name}`);
    setCityId(city.id);

    setCities([]);
    setCityOpen(false);
    setCityActiveIndex(-1);

    setDistrict("");
    setDistricts([]);
    setDistrictOpen(false);
    setDistrictActiveIndex(-1);
  }

  function handleDistrictChange(value: string) {
    setDistrict(value);
    setDistrictOpen(cityId !== null);
    setDistrictActiveIndex(-1);
  }

  function selectDistrict(value: string) {
    setDistrict(value);
    setDistrictOpen(false);
    setDistrictActiveIndex(-1);
  }

  function handleCityKeyDown(
    event: React.KeyboardEvent<HTMLInputElement>,
  ) {
    if (event.key === "Escape") {
      setCityOpen(false);
      setCityActiveIndex(-1);
      return;
    }

    if (event.key === "ArrowDown") {
      event.preventDefault();

      if (!cityOpen) {
        setDistrictOpen(false);
        setCityOpen(true);
        return;
      }

      if (cities.length > 0) {
        setCityActiveIndex((current) =>
          current >= cities.length - 1 ? 0 : current + 1,
        );
      }

      return;
    }

    if (event.key === "ArrowUp") {
      event.preventDefault();

      if (cities.length > 0) {
        setCityActiveIndex((current) =>
          current <= 0 ? cities.length - 1 : current - 1,
        );
      }

      return;
    }

    if (
      event.key === "Enter" &&
      cityOpen &&
      cityActiveIndex >= 0 &&
      cities[cityActiveIndex]
    ) {
      event.preventDefault();
      selectCity(cities[cityActiveIndex]);
    }
  }

  function handleDistrictKeyDown(
    event: React.KeyboardEvent<HTMLInputElement>,
  ) {
    if (event.key === "Escape") {
      setDistrictOpen(false);
      setDistrictActiveIndex(-1);
      return;
    }

    if (event.key === "ArrowDown") {
      if (cityId === null) {
        return;
      }

      event.preventDefault();

      if (!districtOpen) {
        setCityOpen(false);
        setDistrictOpen(true);
        return;
      }

      if (districts.length > 0) {
        setDistrictActiveIndex((current) =>
          current >= districts.length - 1 ? 0 : current + 1,
        );
      }

      return;
    }

    if (event.key === "ArrowUp") {
      if (districts.length > 0) {
        event.preventDefault();

        setDistrictActiveIndex((current) =>
          current <= 0 ? districts.length - 1 : current - 1,
        );
      }

      return;
    }

    if (
      event.key === "Enter" &&
      districtOpen &&
      districtActiveIndex >= 0 &&
      districts[districtActiveIndex]
    ) {
      event.preventDefault();
      selectDistrict(districts[districtActiveIndex]);
    }
  }

  function handleCityScroll() {
    const element = cityListRef.current;

    if (!element) {
      return;
    }

    const remaining =
      element.scrollHeight -
      element.scrollTop -
      element.clientHeight;

    if (remaining < 60) {
      void fetchCities(false);
    }
  }

  function handleDistrictScroll() {
    const element = districtListRef.current;

    if (!element) {
      return;
    }

    const remaining =
      element.scrollHeight -
      element.scrollTop -
      element.clientHeight;

    if (remaining < 60) {
      void fetchDistricts(false);
    }
  }

  return (
    <>
      {/* City */}
      <div
        ref={cityContainerRef}
        className="files-field files-autocomplete"
      >
        <label htmlFor="files-city">{labels.city}</label>

        <div className="files-autocomplete-control">
          <input
            id="files-city"
            type="text"
            value={cityText}
            placeholder={labels.cityPlaceholder}
            autoComplete="off"
            maxLength={100}
            role="combobox"
            aria-autocomplete="list"
            aria-haspopup="listbox"
            aria-expanded={cityOpen}
            aria-controls="files-city-options"
            aria-activedescendant={
              cityActiveIndex >= 0
                ? `files-city-option-${cityActiveIndex}`
                : undefined
            }
            onFocus={() => {
              setDistrictOpen(false);
              setCityOpen(true);
            }}
            onChange={(event) =>
              handleCityChange(event.target.value)
            }
            onKeyDown={handleCityKeyDown}
          />

          <input
            type="hidden"
            name="city"
            value={cityId ?? ""}
          />

          {cityOpen && cities.length > 0 && (
            <div
              id="files-city-options"
              ref={cityListRef}
              className="files-autocomplete-options"
              role="listbox"
              onScroll={handleCityScroll}
            >
              {cities.map((city, index) => (
                <button
                  key={city.id}
                  id={`files-city-option-${index}`}
                  type="button"
                  role="option"
                  aria-selected={city.id === cityId}
                  className={
                    index === cityActiveIndex
                      ? "is-active"
                      : ""
                  }
                  onMouseDown={(event) =>
                    event.preventDefault()
                  }
                  onClick={() => selectCity(city)}
                >
                  <span>{city.name}</span>
                  <small>{city.province_name}</small>
                </button>
              ))}

              {cityLoadingMore && (
                <p className="files-autocomplete-loading">
                  {labels.citySearching}
                </p>
              )}
            </div>
          )}
        </div>

        {(cityLoading || cityLoadingMore) && (
          <p className="files-autocomplete-status" role="status">
            {labels.citySearching}
          </p>
        )}

        {!cityLoading &&
          cityOpen &&
          cityQuery.length > 0 &&
          cities.length === 0 && (
            <p className="files-autocomplete-status">
              {labels.cityNoResults}
            </p>
          )}
      </div>

      {/* District */}
      <div
        ref={districtContainerRef}
        className="files-field files-autocomplete"
      >
        <label htmlFor="files-district">
          {labels.district}
        </label>

        <div className="files-autocomplete-control">
          <input
            id="files-district"
            type="text"
            name="district"
            value={district}
            placeholder={labels.districtPlaceholder}
            autoComplete="off"
            maxLength={80}
            role="combobox"
            aria-autocomplete="list"
            aria-haspopup="listbox"
            aria-expanded={districtOpen}
            aria-controls="files-district-options"
            aria-activedescendant={
              districtActiveIndex >= 0
                ? `files-district-option-${districtActiveIndex}`
                : undefined
            }
            onFocus={() => {
              setCityOpen(false);

              if (cityId !== null) {
                setDistrictOpen(true);
              }
            }}
            onChange={(event) =>
              handleDistrictChange(event.target.value)
            }
            onKeyDown={handleDistrictKeyDown}
          />

          {districtOpen && districts.length > 0 && (
            <div
              id="files-district-options"
              ref={districtListRef}
              className="files-autocomplete-options"
              role="listbox"
              onScroll={handleDistrictScroll}
            >
              {districts.map((item, index) => (
                <button
                  key={item}
                  id={`files-district-option-${index}`}
                  type="button"
                  role="option"
                  aria-selected={item === district}
                  className={
                    index === districtActiveIndex
                      ? "is-active"
                      : ""
                  }
                  onMouseDown={(event) =>
                    event.preventDefault()
                  }
                  onClick={() => selectDistrict(item)}
                >
                  {item}
                </button>
              ))}

              {districtLoadingMore && (
                <p className="files-autocomplete-loading">
                  {labels.citySearching}
                </p>
              )}
            </div>
          )}
        </div>

        <small className="files-field-hint">
          {labels.districtHint}
        </small>

        {districtLoading && (
          <p className="files-autocomplete-status" role="status">
            {labels.citySearching}
          </p>
        )}
      </div>
    </>
  );
}
