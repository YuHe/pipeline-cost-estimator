import logging

from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import select

from app.api.admin import router as admin_router
from app.api.auth import router as auth_router
from app.api.calculate import router as calculate_router
from app.api.compare import router as compare_router
from app.api.module_templates import router as module_templates_router
from app.api.pipelines import router as pipelines_router
from app.api.resource_specs import router as resource_specs_router
from app.api.shares import router as shares_router
from app.api.versions import router as versions_router
from app.core.config import settings
from app.core.database import engine, async_session
from app.core.security import hash_password
from app.models.user import User
from app.models.pipeline import ResourceSpec
from app.models.module_template import ModuleTemplate
from app.models.share_link import ShareLink  # noqa: F401 — imported so Base picks it up

logger = logging.getLogger(__name__)


async def create_super_admin() -> None:
    """Create the super admin user if it does not already exist."""
    async with async_session() as session:
        result = await session.execute(
            select(User).where(User.email == settings.SUPER_ADMIN_EMAIL)
        )
        existing = result.scalar_one_or_none()
        if existing is None:
            admin = User(
                email=settings.SUPER_ADMIN_EMAIL,
                hashed_password=hash_password("admin123"),
                display_name="Super Admin",
                is_admin=True,
            )
            session.add(admin)
            await session.commit()
            logger.info("Super admin user created: %s", settings.SUPER_ADMIN_EMAIL)
        else:
            logger.info("Super admin user already exists: %s", settings.SUPER_ADMIN_EMAIL)


async def seed_resource_specs() -> None:
    """Seed default resource specs if the table is empty."""
    async with async_session() as session:
        result = await session.execute(select(ResourceSpec).limit(1))
        if result.scalar_one_or_none() is not None:
            logger.info("Resource specs already seeded, skipping")
            return

        seed_specs = [
            ResourceSpec(
                name="A100-80G 单卡",
                gpu_type="A100-80G",
                gpu_count=1,
                cost_per_unit=25.0,
                gpus_per_instance=1,
                gpus_per_machine=None,
                qps_per_instance=50.0,
                avg_response_time_ms=100.0,
                is_system=True,
                created_by=None,
            ),
            ResourceSpec(
                name="A100-80G 8卡机",
                gpu_type="A100-80G",
                gpu_count=8,
                cost_per_unit=180.0,
                gpus_per_instance=8,
                gpus_per_machine=8,
                qps_per_instance=50.0,
                avg_response_time_ms=100.0,
                is_system=True,
                created_by=None,
            ),
            ResourceSpec(
                name="V100-32G 单卡",
                gpu_type="V100-32G",
                gpu_count=1,
                cost_per_unit=12.0,
                gpus_per_instance=1,
                gpus_per_machine=None,
                qps_per_instance=30.0,
                avg_response_time_ms=150.0,
                is_system=True,
                created_by=None,
            ),
            ResourceSpec(
                name="T4-16G 单卡",
                gpu_type="T4-16G",
                gpu_count=1,
                cost_per_unit=5.0,
                gpus_per_instance=1,
                gpus_per_machine=None,
                qps_per_instance=20.0,
                avg_response_time_ms=200.0,
                is_system=True,
                created_by=None,
            ),
        ]

        for spec in seed_specs:
            session.add(spec)
        await session.commit()
        logger.info("Seeded %d default resource specs", len(seed_specs))


async def seed_module_templates() -> None:
    """Seed default module templates if the table is empty."""
    async with async_session() as session:
        result = await session.execute(select(ModuleTemplate).limit(1))
        if result.scalar_one_or_none() is not None:
            logger.info("Module templates already seeded, skipping")
            return

        # We need the super admin user's id for created_by
        result = await session.execute(
            select(User).where(User.email == settings.SUPER_ADMIN_EMAIL)
        )
        admin = result.scalar_one_or_none()
        if admin is None:
            logger.warning("Super admin not found, skipping module template seeding")
            return

        seed_templates = [
            ModuleTemplate(
                name="LLM 推理",
                description="大语言模型推理模块模板，适用于文本生成、对话等场景",
                config={
                    "module_type": "llm_inference",
                    "default_gpu_type": "A100-80G",
                    "default_gpu_count": 1,
                    "default_qps": 50,
                    "default_avg_response_time_ms": 100,
                },
                is_global=True,
                created_by=admin.id,
            ),
            ModuleTemplate(
                name="向量检索",
                description="向量数据库检索模块模板，适用于相似度搜索、RAG等场景",
                config={
                    "module_type": "vector_search",
                    "default_gpu_type": "T4-16G",
                    "default_gpu_count": 1,
                    "default_qps": 200,
                    "default_avg_response_time_ms": 20,
                },
                is_global=True,
                created_by=admin.id,
            ),
            ModuleTemplate(
                name="自定义模块",
                description="通用自定义模块模板，可根据需要自行配置参数",
                config={
                    "module_type": "custom",
                    "default_gpu_type": "V100-32G",
                    "default_gpu_count": 1,
                    "default_qps": 100,
                    "default_avg_response_time_ms": 50,
                },
                is_global=True,
                created_by=admin.id,
            ),
        ]

        for template in seed_templates:
            session.add(template)
        await session.commit()
        logger.info("Seeded %d default module templates", len(seed_templates))


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup: run Alembic migrations, then seed data
    from alembic.config import Config
    from alembic import command
    from alembic.migration import MigrationContext
    from alembic.runtime.environment import EnvironmentContext
    from alembic.script import ScriptDirectory

    alembic_cfg = Config("alembic.ini")
    script = ScriptDirectory.from_config(alembic_cfg)

    def run_upgrade(connection):
        context = MigrationContext.configure(connection)
        with EnvironmentContext(
            alembic_cfg,
            script,
            fn=lambda rev, _: script._upgrade_revs("head", rev),
            as_sql=False,
            destination_rev="head",
        ) as env_ctx:
            env_ctx.configure(connection=connection, target_metadata=None)
            with env_ctx.begin_transaction():
                env_ctx.run_migrations()

    async with engine.begin() as conn:
        await conn.run_sync(run_upgrade)
    logger.info("Alembic migrations applied successfully")

    await create_super_admin()
    await seed_resource_specs()
    await seed_module_templates()
    yield
    # Shutdown: dispose of the engine
    await engine.dispose()


app = FastAPI(
    title="Pipeline Cost Estimator",
    version="0.1.0",
    lifespan=lifespan,
)

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Routers
app.include_router(auth_router)
app.include_router(pipelines_router)
app.include_router(versions_router)
app.include_router(calculate_router)
app.include_router(resource_specs_router)
app.include_router(module_templates_router)
app.include_router(shares_router)
app.include_router(compare_router)
app.include_router(admin_router)


@app.get("/api/health")
async def health_check():
    return {"status": "healthy"}
