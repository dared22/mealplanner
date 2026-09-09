from datetime import datetime, timezone
from types import SimpleNamespace
from uuid import uuid4

import pytest
from fastapi import HTTPException

from ingestion.schemas import CandidateRecipeData
from ingestion.service import RecipeImportService


def complete_candidate_data():
    return CandidateRecipeData(
        title="Chicken bowls",
        ingredients=[{"name": "chicken", "quantity": 800, "unit": "g"}],
        instructions=["Cook the chicken.", "Divide into containers."],
        portions=4,
        meal_type="lunch",
        nutrition_per_serving={
            "calories": 520,
            "protein_g": 48,
            "carbs_g": 52,
            "fat_g": 13,
            "source": "creator",
        },
        storage={
            "fridge_days": 3,
            "storage_instructions": "Refrigerate promptly in sealed containers.",
            "reheating_instructions": "Reheat until steaming hot.",
            "rule_version": "foodsafety-no-2026-01",
        },
        source_url="https://www.instagram.com/p/example/",
        attribution="@mealprepchef",
        thumbnail_url="https://res.cloudinary.com/demo/image/upload/example.jpg",
        allergen_reviewed=True,
        dietary_reviewed=True,
        food_safety_confirmed=True,
    )


class FakeRepository:
    def __init__(self, data):
        creator_id = uuid4()
        source_post_id = uuid4()
        self.candidate = SimpleNamespace(
            id=uuid4(),
            creator_id=creator_id,
            source_post_id=source_post_id,
            status="ready_for_review",
            data=data.model_dump(mode="json"),
            approved_recipe_id=None,
        )
        self.creator = SimpleNamespace(
            id=creator_id,
            status="active",
            instagram_username="mealprepchef",
        )
        self.source = SimpleNamespace(
            id=source_post_id,
            creator_id=creator_id,
            source_url="https://www.instagram.com/p/example",
        )
        self.recipe_id = uuid4()
        self.approve_calls = 0

    def get_candidate(self, candidate_id, for_update=False):
        return self.candidate

    def get_creator(self, creator_id, for_update=False):
        return self.creator

    def get_source_post(self, source_post_id):
        return self.source if source_post_id == self.source.id else None

    def approve_candidate(self, candidate, actor, **_kwargs):
        self.approve_calls += 1
        candidate.status = "approved"
        candidate.approved_recipe_id = self.recipe_id
        return self.recipe_id


class CancelRepository:
    def __init__(self):
        self.job = SimpleNamespace(id=uuid4(), status="queued", cancel_requested=False)
        self.cancel_calls = 0

    def get_job(self, job_id):
        return self.job if job_id == self.job.id else None

    def request_cancel(self, job, actor):
        self.cancel_calls += 1
        job.cancel_requested = True
        return job


def test_approval_is_idempotent(monkeypatch):
    monkeypatch.setenv("CLOUDINARY_CLOUD_NAME", "demo")
    repository = FakeRepository(complete_candidate_data())
    service = RecipeImportService(repository, enabled=True)
    actor = SimpleNamespace(id=uuid4(), email="admin@example.com")

    first = service.approve_candidate(repository.candidate.id, actor)
    second = service.approve_candidate(repository.candidate.id, actor)

    assert first == second == repository.recipe_id
    assert repository.approve_calls == 1


def test_approval_rejects_an_incomplete_candidate():
    repository = FakeRepository(CandidateRecipeData(title="Missing details"))
    service = RecipeImportService(repository, enabled=True)

    with pytest.raises(HTTPException) as exc:
        service.approve_candidate(
            repository.candidate.id,
            SimpleNamespace(id=uuid4(), email="admin@example.com"),
        )

    assert exc.value.status_code == 409
    assert "ingredients" in exc.value.detail["blockers"]


def test_approval_rejects_a_thumbnail_from_another_cloudinary_account(monkeypatch):
    monkeypatch.setenv("CLOUDINARY_CLOUD_NAME", "owned-account")
    repository = FakeRepository(complete_candidate_data())
    service = RecipeImportService(repository, enabled=True)

    with pytest.raises(HTTPException) as exc:
        service.approve_candidate(
            repository.candidate.id,
            SimpleNamespace(id=uuid4(), email="admin@example.com"),
        )

    assert exc.value.status_code == 409
    assert "thumbnail" in exc.value.detail["blockers"]


@pytest.mark.parametrize(
    ("field", "value"),
    [
        ("source_url", "https://www.instagram.com/p/different/"),
        ("attribution", "@differentcreator"),
    ],
)
def test_approval_rejects_provenance_that_does_not_match_source_record(
    monkeypatch, field, value
):
    monkeypatch.setenv("CLOUDINARY_CLOUD_NAME", "demo")
    data = complete_candidate_data()
    setattr(data, field, value)
    repository = FakeRepository(data)
    service = RecipeImportService(repository, enabled=True)

    with pytest.raises(HTTPException) as exc:
        service.approve_candidate(
            repository.candidate.id,
            SimpleNamespace(id=uuid4(), email="admin@example.com"),
        )

    assert exc.value.status_code == 409
    assert "source_provenance" in exc.value.detail["blockers"]


def test_admin_can_cancel_queued_work_while_imports_are_disabled():
    repository = CancelRepository()
    service = RecipeImportService(repository, enabled=False)

    result = service.cancel_job(
        repository.job.id,
        SimpleNamespace(id=uuid4(), email="admin@example.com"),
    )

    assert result.cancel_requested is True
    assert repository.cancel_calls == 1
