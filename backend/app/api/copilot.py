"""HelioGPT copilot route."""
from __future__ import annotations

from fastapi import APIRouter

from ..schemas import CopilotIn, CopilotReply
from ..services import copilot

router = APIRouter(prefix="/copilot", tags=["copilot"])


@router.post("/ask", response_model=CopilotReply)
async def ask(payload: CopilotIn) -> CopilotReply:
    result = await copilot.answer(payload.question)
    return CopilotReply.model_validate(result)
