from fastapi import APIRouter
from app.schemas.route import RouteRequest
from app.services.risk_service import score_route

router = APIRouter()

@router.post("/route/test")
async def test_route(request: RouteRequest):
    result = score_route (
        start=request.start,
        end=request.end,
        buffer_feet=request.buffer_feet
    )
    return {
        "start": request.start,
        "end": request.end,
        **result
    }
