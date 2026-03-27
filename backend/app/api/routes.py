from fastapi import APIRouter
from app.schemas.route import RouteRequest, RouteComparisonRequest
from app.services.risk_service import score_route, score_multiple_routes

router = APIRouter()

@router.post("/route/test")
async def test_route(request: RouteRequest):
    result = score_route (
        coordinates=request.coordinates,
        buffer_feet=request.buffer_feet
    )
    return {
        "coordinates": request.coordinates,
        **result
    }

@router.post("/route/compare")
async def compare_routes(request: RouteComparisonRequest):
    results = score_multiple_routes(
        routes=request.routes,
        buffer_feet=request.buffer_feet
    )
    return {
        "buffer_feet": request.buffer_feet,
        "routes": results
    }
