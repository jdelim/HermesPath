from fastapi import FastAPI
app = FastAPI(title="HermesPath API")

@app.get("/health")
async def health():
    return {"status": "ok"}