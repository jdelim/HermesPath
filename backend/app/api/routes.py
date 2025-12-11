from fastapi import APIRouter
from app.schemas.route import RouteRequest

router = APIRouter()

@router.post("/route/test")
async def test_route(request: RouteRequest):
    return {
        "start": request.start,
        "end": request.end,
        "message": "Backend skeleton is working."
    }
