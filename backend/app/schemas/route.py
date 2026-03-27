from pydantic import BaseModel, Field
from typing import List

class RouteRequest(BaseModel):
    coordinates: List[List[float]] = Field(..., min_length=2)
    buffer_feet: float = 250

class CandidateRoute(BaseModel):
    route_name: str
    coordinates: List[List[float]] = Field(..., min_length=2)

class RouteComparisonRequest(BaseModel):
    routes: List[CandidateRoute] = Field(..., min_length=1)
    buffer_feet: float = 250