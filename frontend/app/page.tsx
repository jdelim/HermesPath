"use client";

import dynamic from "next/dynamic";
import { useState } from "react";

const RouteMap = dynamic(() => import("./components/RouteMap"), {
  ssr: false,
});

type RouteResult = {
  route_name: string;
  coordinates: number[][];
  nearby_crashes: number;
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
};

type GeocodeResponse = {
  features: GeocodeFeature[];
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
    `&text=${encodeURIComponent(address)}&size=1`;

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

async function fetchCandidateRoutes(
  startLon: number,
  startLat: number,
  endLon: number,
  endLat: number,
) {
  const apiKey = process.env.NEXT_PUBLIC_ORS_API_KEY;

  if (!apiKey) {
    throw new Error("Missing OpenRouteService API key.");
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
      body: JSON.stringify({
        coordinates: [
          [startLon, startLat],
          [endLon, endLat],
        ],
        alternative_routes: {
          target_count: 3,
          share_factor: 0.6,
          weight_factor: 1.4,
        },
      }),
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

export default function Home() {
  const [startAddress, setStartAddress] = useState("Troy, AL");
  const [endAddress, setEndAddress] = useState("Montgomery, AL");
  const [bufferFeet, setBufferFeet] = useState("250");
  const [results, setResults] = useState<RouteResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function runComparison() {
    setLoading(true);
    setError("");

    try {
      const buffer = Number(bufferFeet);
      if (Number.isNaN(buffer)) {
        throw new Error("Buffer must be a number.");
      }

      const [startLon, startLat] = await geocodeAddress(startAddress);
      const [endLon, endLat] = await geocodeAddress(endAddress);

      const routes = await fetchCandidateRoutes(
        startLon,
        startLat,
        endLon,
        endLat,
      );

      if (routes.length < 2) {
        throw new Error("Could not find at least 2 candidate routes for this trip.");
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
              <label className="flex flex-col gap-2">
                <span className="text-sm text-stone-600">Starting point</span>
                <input
                  value={startAddress}
                  onChange={(e) => setStartAddress(e.target.value)}
                  className="rounded-xl border border-stone-300 px-4 py-3 outline-none focus:border-amber-500"
                  placeholder="123 Main St, Troy, AL"
                />
              </label>

              <label className="flex flex-col gap-2">
                <span className="text-sm text-stone-600">Destination</span>
                <input
                  value={endAddress}
                  onChange={(e) => setEndAddress(e.target.value)}
                  className="rounded-xl border border-stone-300 px-4 py-3 outline-none focus:border-amber-500"
                  placeholder="Montgomery, AL"
                />
              </label>

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
                Green is the safest route. Amber routes are alternatives.
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
                          <p className="text-stone-500">Risk score</p>
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
