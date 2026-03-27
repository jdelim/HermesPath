from pydantic import BaseModel, Field
from typing import List

class RouteRequest(BaseModel):
    coordinates: List[List[float]] = Field(..., min_length=2)
    buffer_feet: float = 250