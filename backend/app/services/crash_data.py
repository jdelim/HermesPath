from pathlib import Path
import pandas as pd
import geopandas as gpd
from shapely.geometry import LineString

BASE_DIR = Path(__file__).resolve().parents[3]
DATA_DIR = BASE_DIR / "FARS2023NationalCSV"
ACCIDENT_CSV = DATA_DIR / "accident.csv"

# read CSV, clean long/lat values, remove rows that dont have it, convert rows into map points
def load_accidents_geo() -> gpd.GeoDataFrame:
    df = pd.read_csv(ACCIDENT_CSV, low_memory=False) # low memory false for mixed type columns

    # create map points (long, lat), store as geo data using standard GPS coords
    gdf = gpd.GeoDataFrame(df, geometry=gpd.points_from_xy(df["LONGITUD"], df["LATITUDE"]), crs="EPSG:4326")

    return gdf

def test_route_buffer():
    accidents = load_accidents_geo()

    # example route
    route_line = LineString([(-86.55, 31.92), (-86.52, 31.94)])

    # insert route into GeoDataFrame
    route_gdf = gpd.GeoDataFrame({"route_name": ["test_route"]},
                                 geometry=[route_line],
                                 crs="EPSG:4326")
    
    # convert into coord ref system bc EPSF:4326 uses degrees, not ft/mtrs
    accidents_proj = accidents.to_crs(epsg=3857)
    route_proj = route_gdf.to_crs(epsg=3857)

    route_buffer = route_proj.buffer(76.2) #meters

    nearby_crashes = accidents_proj[accidents_proj.geometry.within(route_buffer.iloc[0])]

    print(f"Nearby crashes: {len(nearby_crashes)}")
    print(nearby_crashes[["ST_CASE", "LATITUDE", "LONGITUD"]].head())

if __name__ == "__main__":
    gdf = load_accidents_geo()
    print(gdf[["ST_CASE", "LATITUDE", "LONGITUD", "geometry"]].head())
    print(gdf.crs)
    print(f"Rows loaded: {len(gdf)}")

    test_route_buffer()