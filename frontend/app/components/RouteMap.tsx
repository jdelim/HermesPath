"use client";

import { MapContainer, TileLayer, Polyline, CircleMarker, Popup, useMap } from "react-leaflet";
import { LatLngBounds } from "leaflet";
import { useEffect } from "react";

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

function FitToRoutes({ routes }: { routes: RouteResult[] }) {
  const map = useMap();

  useEffect(() => {
    if (routes.length === 0) return;

    const allPoints = routes.flatMap((route) => route.coordinates);
    const bounds = new LatLngBounds(allPoints as [number, number][]);
    map.fitBounds(bounds, { padding: [32, 32] });
  }, [map, routes]);

  return null;
}

export default function RouteMap({ routes }: { routes: RouteResult[] }) {
  const fallbackCenter: [number, number] = [31.93, -86.54];

  return (
    <div className="h-[520px] w-full overflow-hidden rounded-3xl ring-1 ring-stone-200">
      <MapContainer
        center={fallbackCenter}
        zoom={11}
        scrollWheelZoom
        className="h-full w-full"
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />

        <FitToRoutes routes={routes} />

        {routes.map((route) => {
          const color = route.is_safest ? "#059669" : "#b45309";
          const start = route.coordinates[0] as [number, number];
          const end = route.coordinates[route.coordinates.length - 1] as [number, number];

          return (
            <div key={route.route_name}>
              <Polyline
                positions={route.coordinates as [number, number][]}
                pathOptions={{
                  color,
                  weight: route.is_safest ? 6 : 4,
                  opacity: route.is_safest ? 0.95 : 0.7,
                }}
              >
                <Popup>
                  <div className="text-sm">
                    <div className="font-semibold">{route.route_name}</div>
                    <div>Rank: {route.rank}</div>
                    <div>Risk score: {route.risk_score}</div>
                    <div>Nearby crashes: {route.nearby_crashes}</div>
                    <div>Route miles: {route.route_miles}</div>
                  </div>
                </Popup>
              </Polyline>

              <CircleMarker center={start} radius={6} pathOptions={{ color }}>
                <Popup>Start of {route.route_name}</Popup>
              </CircleMarker>

              <CircleMarker center={end} radius={6} pathOptions={{ color }}>
                <Popup>End of {route.route_name}</Popup>
              </CircleMarker>
            </div>
          );
        })}
      </MapContainer>
    </div>
  );
}
