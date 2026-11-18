from alembic import context

from app import config as app_config
from app.db import Base, criar_engine
from app import models  # noqa: F401  (registra as tabelas no metadata)

cfg = context.config
url = cfg.attributes.get("url") or app_config.DATABASE_URL


def rodar_offline() -> None:
    context.configure(url=url, target_metadata=Base.metadata, literal_binds=True,
                      render_as_batch=url.startswith("sqlite"))
    with context.begin_transaction():
        context.run_migrations()


def rodar_online() -> None:
    engine = criar_engine(url)
    with engine.connect() as conn:
        context.configure(connection=conn, target_metadata=Base.metadata,
                          render_as_batch=url.startswith("sqlite"))
        with context.begin_transaction():
            context.run_migrations()
    engine.dispose()


if context.is_offline_mode():
    rodar_offline()
else:
    rodar_online()
