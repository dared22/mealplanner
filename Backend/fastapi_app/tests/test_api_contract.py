import os
import sys
from pathlib import Path
from types import SimpleNamespace
from uuid import uuid4

import pytest
from fastapi import HTTPException
from fastapi.testclient import TestClient


os.environ.setdefault(
    "DATABASE_URL", "postgresql://user:password@localhost:5432/mealplanner_test"
)

BACKEND_DIR = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(BACKEND_DIR))

from main import (
    PreferencePlanResponse,
    RecipeListResponse,
    _recipe_to_dict,
    app,
    current_user_dependency,
    get_session,
    get_preferences,
)


class FakeSession:
    def __init__(self, preference):
        self.preference = preference

    def get(self, _model, _pref_id):
        return self.preference


def test_preference_response_is_owner_scoped_and_contains_only_plan_fields():
    owner = SimpleNamespace(id=uuid4())
    preference = SimpleNamespace(
        id=1,
        user_id=owner.id,
        raw_data={
            "generated_plan": {
                "plan": {"days": []},
                "generation_source": "hybrid",
            },
            "generation_stage": "finding_recipes",
            "secret_questionnaire_data": "must not be exposed",
        },
    )

    response = get_preferences(
        1,
        background_tasks=None,
        lang=None,
        db=FakeSession(preference),
        current_user=owner,
    )

    assert set(response) == {
        "plan_status",
        "generation_stage",
        "plan",
        "error",
        "generation_source",
        "recommendation_reasons",
        "translation_status",
        "translation_error",
    }
    assert response["plan_status"] == "success"
    assert response["plan"] == {"days": []}
    assert "secret_questionnaire_data" not in response


def test_preference_response_hides_records_owned_by_another_user():
    owner = SimpleNamespace(id=uuid4())
    other_user = SimpleNamespace(id=uuid4())
    preference = SimpleNamespace(id=1, user_id=owner.id, raw_data={})

    with pytest.raises(HTTPException) as exc_info:
        get_preferences(
            1,
            background_tasks=None,
            lang=None,
            db=FakeSession(preference),
            current_user=other_user,
        )

    assert exc_info.value.status_code == 404


def test_recipe_response_contains_only_the_canonical_public_fields():
    recipe = SimpleNamespace(
        id=uuid4(),
        title="Lentil bowl",
        image_url="https://images.example/lentil-bowl.jpg",
        meal_type="dinner",
        tags=["vegan", "high_protein"],
        ingredients=["1 cup lentils"],
        total_time_minutes=30,
        nutrition={
            "calories_kcal": 540,
            "protein_g": 28,
            "carbs_g": 72,
            "fat_g": 12,
        },
    )

    response = _recipe_to_dict(recipe)

    assert set(response) == {
        "id",
        "title",
        "image_url",
        "meal_type",
        "tags",
        "ingredients",
        "total_time_minutes",
        "nutrition",
    }
    assert response["nutrition"] == {
        "calories": 540,
        "protein_g": 28,
        "carbs_g": 72,
        "fat_g": 12,
    }


def test_removed_legacy_routes_are_not_registered():
    routes = {route.path for route in app.routes}

    assert "/auth/session" not in routes
    assert "/users/{user_id}/preferences" not in routes
    assert "/plans/history" not in routes


def test_preferences_and_recipes_require_an_authenticated_user():
    routes = {route.path: route for route in app.routes}

    for path in ("/preferences/{pref_id}", "/recipes"):
        dependencies = routes[path].dependant.dependencies
        assert any(dependency.call is current_user_dependency for dependency in dependencies)


def test_unauthenticated_preferences_and_recipes_requests_are_rejected():
    app.dependency_overrides[get_session] = lambda: FakeSession(None)
    client = TestClient(app)

    try:
        assert client.get("/preferences/1").status_code == 401
        assert client.get("/recipes").status_code == 401
    finally:
        app.dependency_overrides.clear()


def test_preferences_owner_scope_is_enforced_at_the_http_boundary():
    owner = SimpleNamespace(id=uuid4())
    other_user = SimpleNamespace(id=uuid4())
    preference = SimpleNamespace(
        id=1,
        user_id=owner.id,
        raw_data={"generated_plan": {"plan": {"days": []}}},
    )
    app.dependency_overrides[get_session] = lambda: FakeSession(preference)
    app.dependency_overrides[current_user_dependency] = lambda: other_user
    client = TestClient(app)

    try:
        assert client.get("/preferences/1").status_code == 404
    finally:
        app.dependency_overrides.clear()


def test_response_models_expose_only_the_reduced_contracts():
    assert set(PreferencePlanResponse.model_fields) == {
        "plan_status",
        "generation_stage",
        "plan",
        "error",
        "generation_source",
        "recommendation_reasons",
        "translation_status",
        "translation_error",
    }
    assert set(RecipeListResponse.model_fields) == {"items"}
