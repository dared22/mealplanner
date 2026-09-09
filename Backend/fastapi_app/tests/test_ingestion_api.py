from datetime import datetime, timezone
from types import SimpleNamespace
from uuid import uuid4

from fastapi import FastAPI
from fastapi.testclient import TestClient

from ingestion.api import create_recipe_import_router, get_import_service


class FakeService:
    def readiness(self):
        return {
            "enabled": True,
            "ready": False,
            "checks": {
                "meta": {"ready": False, "detail": "META_ACCESS_TOKEN is missing"}
            },
        }

    def create_creator(self, payload, actor):
        now = datetime.now(timezone.utc)
        return {
            "id": uuid4(),
            "instagram_username": payload.username,
            "profile_url": payload.profile_url,
            "display_name": payload.display_name,
            "allowed_domains": payload.allowed_domains,
            "permission_basis": payload.permission_basis,
            "permission_record_url": payload.permission_record_url,
            "permission_confirmed_at": now,
            "status": "active",
            "created_at": now,
            "updated_at": now,
            "last_scanned_at": None,
        }


def test_admin_can_add_an_allowlisted_creator_through_public_api():
    app = FastAPI()
    app.include_router(
        create_recipe_import_router(
            lambda: SimpleNamespace(id=uuid4(), email="admin@example.com")
        )
    )
    app.dependency_overrides[get_import_service] = lambda: FakeService()
    client = TestClient(app)

    response = client.post(
        "/admin/recipe-imports/creators",
        json={
            "profile_url": "https://www.instagram.com/mealprepchef/",
            "allowed_domains": ["mealprepchef.com"],
            "permission_basis": "Written permission retained by the content team",
            "permission_confirmed": True,
        },
    )

    assert response.status_code == 201
    assert response.json()["instagram_username"] == "mealprepchef"


def test_readiness_is_actionable_instead_of_hiding_missing_credentials():
    app = FastAPI()
    app.include_router(create_recipe_import_router(lambda: SimpleNamespace(id=uuid4())))
    app.dependency_overrides[get_import_service] = lambda: FakeService()

    response = TestClient(app).get("/admin/recipe-imports/readiness")

    assert response.status_code == 200
    assert response.json()["checks"]["meta"]["detail"].endswith("is missing")
