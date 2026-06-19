"""Alert center routes."""
from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from ..db import get_db
from ..deps import get_current_user
from ..models import Alert, User
from ..schemas import AlertOut

router = APIRouter(prefix="/alerts", tags=["alerts"])


@router.get("", response_model=list[AlertOut])
async def list_alerts(
    limit: int = 50, db: AsyncSession = Depends(get_db)
) -> list[AlertOut]:
    rows = (
        (
            await db.execute(
                select(Alert).order_by(Alert.created_at.desc()).limit(limit)
            )
        )
        .scalars()
        .all()
    )
    return [AlertOut.model_validate(r) for r in rows]


@router.post("/{alert_id}/ack", response_model=AlertOut)
async def acknowledge(
    alert_id: int,
    db: AsyncSession = Depends(get_db),
    _user: User = Depends(get_current_user),
) -> AlertOut:
    alert = await db.get(Alert, alert_id)
    if not alert:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Alert not found")
    alert.acknowledged = True
    await db.commit()
    await db.refresh(alert)
    return AlertOut.model_validate(alert)
