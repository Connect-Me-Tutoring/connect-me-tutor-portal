import os
from dotenv import load_dotenv

load_dotenv()

for key in ["GEMINI_API_KEY", "GOOGLE_API_KEY"]:
    if key not in os.environ and "GOOGLE_GENERATIVE_AI_API_KEY" in os.environ:
        os.environ[key] = os.environ["GOOGLE_GENERATIVE_AI_API_KEY"]

from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pydantic import BaseModel

from agent import AgentDeps, tutor_agent
from handbook import get_handbook_text, get_handbook_status, refresh_handbook


@asynccontextmanager
async def lifespan(app: FastAPI):
    await get_handbook_text()
    yield


app = FastAPI(lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "https://www.connectmego.app",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


class ChatRequest(BaseModel):
    message: str
    history: list[dict] = []


class ChatResponse(BaseModel):
    response: str


class HandbookStatus(BaseModel):
    cached: bool
    last_fetched: str | None
    text_length: int
    cache_age_seconds: float | None


@app.get("/health")
async def health():
    return {"status": "ok"}


@app.post("/chat", response_model=ChatResponse)
async def chat(request: ChatRequest):
    handbook_text = await get_handbook_text()
    deps = AgentDeps(handbook_text=handbook_text)

    messages = []
    for msg in request.history:
        messages.append({"role": msg["role"], "content": msg["content"]})
    messages.append({"role": "user", "content": request.message})

    result = await tutor_agent.run(request.message, deps=deps, message_history=messages[:-1])
    return ChatResponse(response=result.output)


@app.get("/handbook/status", response_model=HandbookStatus)
async def handbook_status():
    status = get_handbook_status()
    return HandbookStatus(**status)


@app.post("/handbook/refresh")
async def handbook_refresh():
    text = await refresh_handbook()
    return {
        "status": "refreshed",
        "text_length": len(text),
    }


@app.post("/chat/stream")
async def chat_stream(request: ChatRequest):
    handbook_text = await get_handbook_text()
    deps = AgentDeps(handbook_text=handbook_text)

    messages = []
    for msg in request.history:
        messages.append({"role": msg["role"], "content": msg["content"]})

    async def token_generator():
        async with tutor_agent.run_stream(
            request.message, deps=deps, message_history=messages
        ) as stream:
            async for chunk in stream.stream_text(delta=True):
                yield chunk

    return StreamingResponse(token_generator(), media_type="text/plain")
