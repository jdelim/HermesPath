from pydantic import BaseModel
from typing import List

class RouteRequest(BaseModel):
    start: List[float]   # [lat, lon]
    end: List[float]     # [lat, lon]
