"""Instagram recipe-import workflow.

The package is intentionally exposed through the API router and worker entry
point. Provider details remain private so they can be replaced in tests and
without changing the admin API.
"""

__all__ = ["create_recipe_import_router"]


def __getattr__(name):
    if name == "create_recipe_import_router":
        from .api import create_recipe_import_router

        return create_recipe_import_router
    raise AttributeError(name)
