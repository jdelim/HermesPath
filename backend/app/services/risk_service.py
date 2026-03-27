import geopandas as gpd
from shapely.geometry import LineString

from app.services.crash_data import load_accidents_geo

FEET_TO_METERS = 0.3048
METERS_TO_MILES = 0.000621371

def build_route_line(coordinates: list[list[float]]) -> LineString:
    # origin is [lat, lon] but shapely expects (lon, lat)
    line_points = [(point[1], point[0]) for point in coordinates]
    return LineString(line_points)

def count_nearby_fatal_crashes(route_line: LineString, buffer_feet: float = 250) -> int:
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

    nearby_crashes = accidents_proj[accidents_proj.geometry.within(route_buffer.iloc[0])] # filter crash points within route corridor

    return len(nearby_crashes)

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
    nearby_crashes = count_nearby_fatal_crashes(route_line, buffer_feet)
    route_miles = calculate_route_miles(route_line)

    risk_score = 0.0
    if route_miles > 0:
        risk_score = nearby_crashes / route_miles
    
    return {
        "nearby_crashes": nearby_crashes,
        "route_miles": round(route_miles, 3),
        "risk_score": round(risk_score, 3),
        "buffer_feet": buffer_feet
    }