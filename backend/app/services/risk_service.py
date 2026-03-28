import geopandas as gpd
from shapely.geometry import LineString

from app.services.crash_data import load_accidents_geo

FEET_TO_METERS = 0.3048
METERS_TO_MILES = 0.000621371

def build_route_line(coordinates: list[list[float]]) -> LineString:
    # origin is [lat, lon] but shapely expects (lon, lat)
    line_points = [(point[1], point[0]) for point in coordinates]
    return LineString(line_points)

def get_nearby_fatal_crashes(route_line: LineString, buffer_feet: float = 250) -> list[dict]:
    accidents = load_accidents_geo()

    route_gdf = gpd.GeoDataFrame(
        {"route_name": ["route"]},
        geometry=[route_line],
        crs="EPSG:4326"
    )
    
    # EPSG:4326 is in degrees, 3857 is coord system in meters
    accidents_proj = accidents.to_crs(epsg=3857)
    route_proj = route_gdf.to_crs(epsg=3857)

    buffer_meters = buffer_feet * FEET_TO_METERS
    route_buffer = route_proj.buffer(buffer_meters) # create zone around the line

    # filter accidents that fall within buffered route polygon
    nearby_crashes = accidents_proj[accidents_proj.geometry.within(route_buffer.iloc[0])].to_crs(epsg=4326)

    crash_points = []
    for _, crash in nearby_crashes.iterrows():
        crash_points.append({
            "st_case": int(crash["ST_CASE"]) if not gpd.pd.isna(crash["ST_CASE"]) else None,
            "latitude": float(crash.geometry.y),
            "longitude": float(crash.geometry.x),
            "year": int(crash["YEAR"]) if "YEAR" in crash and not gpd.pd.isna(crash["YEAR"]) else None,
            "state": str(crash["STATENAME"]) if "STATENAME" in crash and not gpd.pd.isna(crash["STATENAME"]) else None,
        })

    return crash_points

def calculate_route_miles(route_line: LineString) -> float:
    route_gdf = gpd.GeoDataFrame(
        {"route_name": ["route"]},
        geometry=[route_line],
        crs="EPSG:4326"
    )

    route_proj = route_gdf.to_crs(epsg=3857)
    route_length_meters = route_proj.geometry.length.iloc[0]

    return route_length_meters * METERS_TO_MILES

def score_route(coordinates: list[list[float]], buffer_feet: float = 250) -> dict:
    route_line = build_route_line(coordinates)
    crash_points = get_nearby_fatal_crashes(route_line, buffer_feet)
    route_miles = calculate_route_miles(route_line)

    nearby_crashes = len(crash_points)

    # RISK LOGIC
    risk_score = 0.0
    if route_miles > 0:
        risk_score = nearby_crashes / route_miles
    
    return {
        "nearby_crashes": nearby_crashes,
        "crash_points": crash_points,
        "route_miles": round(route_miles, 3),
        "risk_score": round(risk_score, 3),
        "buffer_feet": buffer_feet
    }

def score_multiple_routes(routes: list, buffer_feet: float = 250) -> list[dict]:
    scored_routes = []

    for route in routes:
        result = score_route(
            coordinates=route.coordinates,
            buffer_feet=buffer_feet
        )

        scored_routes.append({
            "route_name": route.route_name,
            "coordinates": route.coordinates,
            **result
        })

    scored_routes.sort(key=lambda route: route["risk_score"])

    # route ranking
    for index, route in enumerate(scored_routes, start=1):
        route["rank"] = index
        route["is_safest"] = index == 1

    return scored_routes