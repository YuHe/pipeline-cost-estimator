import secrets
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.deps import get_current_user, get_db
from app.models.pipeline import Pipeline, PipelineVersion
from app.models.share_link import ShareLink
from app.models.user import User
from app.schemas.share import ShareLinkCreate, ShareLinkOut, ShareViewOut

router = APIRouter(prefix="/api/shares", tags=["shares"])


@router.post("/", response_model=ShareLinkOut, status_code=status.HTTP_201_CREATED)
async def create_share_link(
    payload: ShareLinkCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> ShareLinkOut:
    """Create a share link for a pipeline."""
    # Verify pipeline ownership
    result = await db.execute(
        select(Pipeline).where(
            Pipeline.id == payload.pipeline_id,
            Pipeline.owner_id == current_user.id,
        )
    )
    pipeline = result.scalar_one_or_none()
    if pipeline is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Pipeline not found",
        )

    # If version_id is provided, verify it belongs to the pipeline
    if payload.version_id is not None:
        result = await db.execute(
            select(PipelineVersion).where(
                PipelineVersion.id == payload.version_id,
                PipelineVersion.pipeline_id == payload.pipeline_id,
            )
        )
        version = result.scalar_one_or_none()
        if version is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Pipeline version not found",
            )

    token = secrets.token_urlsafe(32)
    expires_at = datetime.now(timezone.utc) + timedelta(hours=payload.expires_in_hours)

    share_link = ShareLink(
        pipeline_id=payload.pipeline_id,
        version_id=payload.version_id,
        token=token,
        created_by=current_user.id,
        expires_at=expires_at,
    )
    db.add(share_link)
    await db.flush()
    return ShareLinkOut.model_validate(share_link)


@router.get("/view/{token}", response_model=ShareViewOut)
async def view_shared_pipeline(
    token: str,
    db: AsyncSession = Depends(get_db),
) -> ShareViewOut:
    """View a shared pipeline. NO AUTH REQUIRED."""
    result = await db.execute(
        select(ShareLink).where(ShareLink.token == token)
    )
    share_link = result.scalar_one_or_none()
    if share_link is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Share link not found",
        )

    # Check expiry
    now = datetime.now(timezone.utc)
    is_expired = now > share_link.expires_at

    # Fetch pipeline
    result = await db.execute(
        select(Pipeline).where(Pipeline.id == share_link.pipeline_id)
    )
    pipeline = result.scalar_one_or_none()
    if pipeline is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Pipeline not found",
        )

    # Determine which version to show
    version_id = share_link.version_id or pipeline.current_version_id
    config: dict = {}
    cost_snapshot: dict | None = None

    if version_id is not None:
        result = await db.execute(
            select(PipelineVersion).where(PipelineVersion.id == version_id)
        )
        version = result.scalar_one_or_none()
        if version is not None:
            config = version.config
            cost_snapshot = version.cost_snapshot

    return ShareViewOut(
        pipeline_name=pipeline.name,
        config=config,
        cost_snapshot=cost_snapshot,
        is_expired=is_expired,
    )


@router.delete("/{share_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_share_link(
    share_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> None:
    """Delete a share link. Only the creator can delete."""
    result = await db.execute(
        select(ShareLink).where(ShareLink.id == share_id)
    )
    share_link = result.scalar_one_or_none()
    if share_link is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Share link not found",
        )

    if share_link.created_by != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You do not have permission to delete this share link",
        )

    await db.delete(share_link)
    await db.flush()
