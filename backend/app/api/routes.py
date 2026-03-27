from fastapi import APIRouter
from app.schemas.route import RouteRequest
from app.services.risk_service import score_route

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
