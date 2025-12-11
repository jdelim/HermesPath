from fastapi import FastAPI
from backend.app.api.routes import router

app = FastAPI(
    title="HermesPath API",
    description="Route safety scoring API",
    version="0.1.0"
)

app.include_router(router)

@app.get("/health")
async def health_check():
    return {"status": "ok"}
