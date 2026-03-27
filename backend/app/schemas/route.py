from pydantic import BaseModel, Field
from typing import List

class RouteRequest(BaseModel):
    start: List[float] = Field(..., min_length=2, max_length=2)   # [lat, lon]
    end: List[float] = Field(..., min_length=2, max_length=2)    # [lat, lon]
    buffer_feet: float = 250