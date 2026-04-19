from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.deps import get_current_user, get_db
from app.models.module_template import ModuleTemplate
from app.models.user import User
from app.schemas.module_template import ModuleTemplateCreate, ModuleTemplateOut

router = APIRouter(prefix="/api/module-templates", tags=["module-templates"])


@router.get("/", response_model=list[ModuleTemplateOut])
async def list_templates(
    q: str | None = Query(default=None, description="Search query for template name"),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> list[ModuleTemplateOut]:
    """List all templates: global templates and the current user's own templates."""
    query = select(ModuleTemplate).where(
        or_(
            ModuleTemplate.is_global == True,  # noqa: E712
            ModuleTemplate.created_by == current_user.id,
        )
    )
    if q is not None and q.strip():
        query = query.where(ModuleTemplate.name.ilike(f"%{q.strip()}%"))
    query = query.order_by(ModuleTemplate.created_at.desc())

    result = await db.execute(query)
    templates = result.scalars().all()
    return [ModuleTemplateOut.model_validate(t) for t in templates]


@router.post("/", response_model=ModuleTemplateOut, status_code=status.HTTP_201_CREATED)
async def create_template(
    payload: ModuleTemplateCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> ModuleTemplateOut:
    """Create a new module template."""
    template = ModuleTemplate(
        name=payload.name,
        description=payload.description,
        config=payload.config,
        is_global=False,
        created_by=current_user.id,
    )
    db.add(template)
    await db.flush()
    return ModuleTemplateOut.model_validate(template)


@router.delete("/{template_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_template(
    template_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> None:
    """Delete a module template. Users can delete their own; admins can delete any."""
    result = await db.execute(
        select(ModuleTemplate).where(ModuleTemplate.id == template_id)
    )
    template = result.scalar_one_or_none()
    if template is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Module template not found",
        )

    # Only the creator or an admin can delete
    if template.created_by != current_user.id and not current_user.is_admin:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You do not have permission to delete this template",
        )

    await db.delete(template)
    await db.flush()
