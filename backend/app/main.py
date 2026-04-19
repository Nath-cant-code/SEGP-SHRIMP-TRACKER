from contextlib import asynccontextmanager
import os

from dotenv import load_dotenv
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.openapi.utils import get_openapi

from app.db.database import Base, engine
import app.db.models
from app.routes.models import router as models_router
from app.routes.analyze import router as analyze_router
from app.routes.results import router as results_router

load_dotenv()


@asynccontextmanager
async def lifespan(app: FastAPI):
    Base.metadata.create_all(bind=engine)
    yield


app = FastAPI(title="SEGP Shrimp Tracker Backend", lifespan=lifespan)

frontend_origin = os.getenv("FRONTEND_ORIGIN", "http://localhost:5173")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[frontend_origin],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(models_router)
app.include_router(analyze_router)
app.include_router(results_router)


def custom_openapi():
    if app.openapi_schema:
        return app.openapi_schema

    openapi_schema = get_openapi(
        title=app.title,
        version="0.1.0",
        routes=app.routes,
    )

    body_schema = openapi_schema["components"]["schemas"].get("Body_analyze_videos_analyze_post")
    if body_schema and "properties" in body_schema and "videos" in body_schema["properties"]:
        videos_prop = body_schema["properties"]["videos"]
        if "items" in videos_prop:
            videos_prop["items"]["type"] = "string"
            videos_prop["items"]["format"] = "binary"
            videos_prop["items"].pop("contentMediaType", None)

    app.openapi_schema = openapi_schema
    return app.openapi_schema


app.openapi = custom_openapi


@app.get("/health")
def health():
    return {"status": "ok"}