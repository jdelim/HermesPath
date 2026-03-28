"use client";

import dynamic from "next/dynamic";
import { useEffect, useRef, useState } from "react";

const RouteMap = dynamic(() => import("./components/RouteMap"), {
  ssr: false,
});

type CrashPoint = {
  st_case: number | null;
  latitude: number;
  longitude: number;
  year: number | null;
  state: string | null;
};

type RouteResult = {
  route_name: string;
  coordinates: number[][];
  nearby_crashes: number;
  crash_points: CrashPoint[];
  route_miles: number;
  risk_score: number;
  buffer_feet: number;
  rank: number;
  is_safest: boolean;
};

type CompareResponse = {
  buffer_feet: number;
  routes: RouteResult[];
};

type GeocodeFeature = {
  geometry: {
    coordinates: [number, number];
  };
  properties?: {
    label?: string;
  };
};

type GeocodeResponse = {
  features: GeocodeFeature[];
};

type Suggestion = {
  label: string;
  coordinates: [number, number];
};

type DirectionsFeature = {
  geometry: {
    coordinates: number[][];
  };
};

type DirectionsResponse = {
  features: DirectionsFeature[];
};

async function geocodeAddress(address: string): Promise<[number, number]> {
  const apiKey = process.env.NEXT_PUBLIC_ORS_API_KEY;

  if (!apiKey) {
    throw new Error("Missing OpenRouteService API key.");
  }

  const url =
    `https://api.openrouteservice.org/geocode/search?api_key=${apiKey}` +
    `&text=${encodeURIComponent(address)}&size=1&boundary.country=USA`;

  const response = await fetch(url);

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Geocoding failed: ${response.status} ${text}`);
  }

  const data = (await response.json()) as GeocodeResponse;
  const first = data.features[0];

  if (!first) {
    throw new Error(`No geocoding result found for "${address}".`);
  }

  return first.geometry.coordinates;
}

async function fetchAddressSuggestions(query: string): Promise<Suggestion[]> {
  const apiKey = process.env.NEXT_PUBLIC_ORS_API_KEY;

  if (!apiKey || query.trim().length < 3) {
    return [];
  }

  const url =
    `https://api.openrouteservice.org/geocode/autocomplete?api_key=${apiKey}` +
    `&text=${encodeURIComponent(query)}&size=5&boundary.country=USA`;

  const response = await fetch(url);

  if (!response.ok) {
    return [];
  }

  const data = (await response.json()) as GeocodeResponse;

  return data.features.map((feature) => ({
    label: feature.properties?.label ?? "Unknown result",
    coordinates: feature.geometry.coordinates,
  }));
}


async function fetchCandidateRoutes(
  startLon: number,
  startLat: number,
  endLon: number,
  endLat: number,
): Promise<{
  routes: { route_name: string; coordinates: number[][] }[];
  usedLongTripFallback: boolean;
}> {
  const apiKey = process.env.NEXT_PUBLIC_ORS_API_KEY;

  if (!apiKey) {
    throw new Error("Missing OpenRouteService API key.");
  }

  async function requestRoutes(useAlternatives: boolean) {
    const body: {
      coordinates: number[][];
      alternative_routes?: {
        target_count: number;
        share_factor: number;
        weight_factor: number;
      };
    } = {
      coordinates: [
        [startLon, startLat],
        [endLon, endLat],
      ],
    };

    if (useAlternatives) {
      body.alternative_routes = {
        target_count: 3,
        share_factor: 0.6,
        weight_factor: 1.4,
      };
    }

    const response = await fetch(
      "https://api.openrouteservice.org/v2/directions/driving-car/geojson",
      {
        method: "POST",
        headers: {
          Authorization: apiKey,
          "Content-Type": "application/json",
          Accept: "application/json, application/geo+json",
        },
        body: JSON.stringify(body),
      },
    );

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`Routing failed: ${response.status} ${text}`);
    }

    const data = (await response.json()) as DirectionsResponse;

    return data.features.map((feature, index) => ({
      route_name: `route_${index + 1}`,
      coordinates: feature.geometry.coordinates.map(([lon, lat]) => [lat, lon]),
    }));
  }

  try {
    const routes = await requestRoutes(true);
    return {
      routes,
      usedLongTripFallback: false,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : "";

    const exceededAlternativeLimit =
      message.includes('"code":2004') &&
      message.includes("must not be greater than 150000.0 meters");

    if (!exceededAlternativeLimit) {
      throw err;
    }

    const routes = await requestRoutes(false);

    return {
      routes,
      usedLongTripFallback: true,
    };
  }
}

function AddressAutocomplete({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
}) {
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const timeoutId = window.setTimeout(async () => {
      if (value.trim().length < 3) {
        setSuggestions([]);
        setOpen(false);
        return;
      }

      setLoading(true);
      const next = await fetchAddressSuggestions(value);
      setSuggestions(next);
      setOpen(next.length > 0);
      setLoading(false);
    }, 250);

    return () => window.clearTimeout(timeoutId);
  }, [value]);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        setOpen(false);
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <label className="flex flex-col gap-2">
      <span className="text-sm text-stone-600">{label}</span>

      <div className="relative" ref={containerRef}>
        <input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onFocus={() => {
            if (suggestions.length > 0) setOpen(true);
          }}
          className="w-full rounded-xl border border-stone-300 px-4 py-3 outline-none focus:border-amber-500"
          placeholder={placeholder}
        />

        {open ? (
          <div className="absolute z-[1000] mt-2 w-full overflow-hidden rounded-2xl border border-stone-200 bg-white shadow-lg">
            {loading ? (
              <div className="px-4 py-3 text-sm text-stone-500">
                Searching...
              </div>
            ) : suggestions.length === 0 ? (
              <div className="px-4 py-3 text-sm text-stone-500">
                No matches found.
              </div>
            ) : (
              suggestions.map((suggestion) => (
                <button
                  key={`${suggestion.label}-${suggestion.coordinates.join(",")}`}
                  type="button"
                  onClick={() => {
                    onChange(suggestion.label);
                    setOpen(false);
                  }}
                  className="block w-full px-4 py-3 text-left text-sm hover:bg-stone-50"
                >
                  {suggestion.label}
                </button>
              ))
            )}
          </div>
        ) : null}
      </div>
    </label>
  );
}

export default function Home() {
  const [startAddress, setStartAddress] = useState("Troy, AL");
  const [endAddress, setEndAddress] = useState("Montgomery, AL");
  const [bufferFeet, setBufferFeet] = useState("250");
  const [results, setResults] = useState<RouteResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  async function runComparison() {
  setLoading(true);
  setError("");
  setNotice("");

  try {
    const buffer = Number(bufferFeet);
    if (Number.isNaN(buffer)) {
      throw new Error("Buffer must be a number.");
    }

    const [startLon, startLat] = await geocodeAddress(startAddress);
    const [endLon, endLat] = await geocodeAddress(endAddress);

    const { routes, usedLongTripFallback } = await fetchCandidateRoutes(
      startLon,
      startLat,
      endLon,
      endLat,
    );

    if (routes.length === 0) {
      throw new Error("Could not find any route for this trip.");
    }

    if (usedLongTripFallback) {
      setNotice(
        "This trip is too long for multiple route options, so HermesPath is showing the main route only.",
      );
    }

    const compareResponse = await fetch("http://127.0.0.1:8000/route/compare", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        routes,
        buffer_feet: buffer,
      }),
    });

    if (!compareResponse.ok) {
      const text = await compareResponse.text();
      throw new Error(`Backend failed: ${compareResponse.status} ${text}`);
    }

    const data = (await compareResponse.json()) as CompareResponse;
    setResults(data.routes);
  } catch (err) {
    setError(err instanceof Error ? err.message : "Something went wrong.");
  } finally {
    setLoading(false);
  }
}

  return (
    <main className="min-h-screen bg-stone-100 px-6 py-10 text-stone-900">
      <div className="mx-auto max-w-6xl">
        <section className="rounded-3xl bg-white p-8 shadow-sm ring-1 ring-stone-200">
          <h1 className="text-4xl font-semibold tracking-tight">HermesPath</h1>
          <p className="mt-4 max-w-2xl text-stone-600">
            Enter two addresses, fetch candidate driving routes, and compare them by
            historical fatal-crash exposure per mile.
          </p>
        </section>

        <section className="mt-6 grid gap-6 lg:grid-cols-[0.8fr_1.2fr]">
          <div className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-stone-200">
            <h2 className="text-xl font-semibold">Trip Inputs</h2>

            <div className="mt-4 flex flex-col gap-4">
              <AddressAutocomplete
                label="Starting point"
                value={startAddress}
                onChange={setStartAddress}
                placeholder="123 Main St, Troy, AL"
              />

              <AddressAutocomplete
                label="Destination"
                value={endAddress}
                onChange={setEndAddress}
                placeholder="Montgomery, AL"
              />
              <p className="text-xs text-stone-500">
                Alternative route comparison works best for trips up to about 93 miles.
                Longer trips may show only the main route.
              </p>

              <label className="flex flex-col gap-2">
                <span className="text-sm text-stone-600">Buffer feet</span>
                <input
                  value={bufferFeet}
                  onChange={(e) => setBufferFeet(e.target.value)}
                  className="rounded-xl border border-stone-300 px-4 py-3 outline-none focus:border-amber-500"
                />
              </label>
            </div>

            <button
              onClick={runComparison}
              disabled={loading}
              className="mt-6 rounded-full bg-amber-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-amber-700 disabled:cursor-not-allowed disabled:bg-stone-400"
            >
              {loading ? "Comparing..." : "Compare Routes"}
            </button>

            {notice ? (
              <p className="mt-4 rounded-2xl bg-amber-50 px-4 py-3 text-sm text-amber-800 ring-1 ring-amber-200">
                {notice}
              </p>
            ) : null}

            {error ? (
              <p className="mt-4 rounded-2xl bg-red-50 px-4 py-3 text-sm text-red-700 ring-1 ring-red-200">
                {error}
              </p>
            ) : null}
          </div>

          <div className="flex flex-col gap-6">
            <section className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-stone-200">
              <h2 className="text-xl font-semibold">Route Map</h2>
              <p className="mt-2 text-sm text-stone-600">
                If multiple routes are available, the safest route is shown in green.
              </p>
              <div className="mt-4">
                <RouteMap routes={results} />
              </div>
            </section>

            <section className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-stone-200">
              <h2 className="text-xl font-semibold">Ranked Results</h2>

              <div className="mt-6 flex flex-col gap-4">
                {results.length === 0 ? (
                  <div className="rounded-2xl border border-dashed border-stone-300 px-4 py-6 text-sm text-stone-500">
                    No results yet.
                  </div>
                ) : (
                  results.map((route) => (
                    <article
                      key={route.route_name}
                      className={`rounded-2xl p-5 ring-1 ${
                        route.is_safest
                          ? "bg-emerald-50 ring-emerald-200"
                          : "bg-stone-50 ring-stone-200"
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm uppercase tracking-[0.2em] text-stone-500">
                            Rank {route.rank}
                          </p>
                          <h3 className="mt-1 text-lg font-semibold">{route.route_name}</h3>
                        </div>

                        {route.is_safest ? (
                          <span className="rounded-full bg-emerald-600 px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-white">
                            Safest
                          </span>
                        ) : null}
                      </div>

                      <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
                        <div className="rounded-xl bg-white px-4 py-3 ring-1 ring-stone-200">
                          <p className="text-stone-500">Crashes per mile</p>
                          <p className="mt-1 text-lg font-semibold">{route.risk_score}</p>
                        </div>
                        <div className="rounded-xl bg-white px-4 py-3 ring-1 ring-stone-200">
                          <p className="text-stone-500">Nearby crashes</p>
                          <p className="mt-1 text-lg font-semibold">{route.nearby_crashes}</p>
                        </div>
                        <div className="rounded-xl bg-white px-4 py-3 ring-1 ring-stone-200">
                          <p className="text-stone-500">Route miles</p>
                          <p className="mt-1 text-lg font-semibold">{route.route_miles}</p>
                        </div>
                        <div className="rounded-xl bg-white px-4 py-3 ring-1 ring-stone-200">
                          <p className="text-stone-500">Buffer feet</p>
                          <p className="mt-1 text-lg font-semibold">{route.buffer_feet}</p>
                        </div>
                      </div>
                    </article>
                  ))
                )}
              </div>
            </section>
          </div>
        </section>
      </div>
    </main>
  );
}
