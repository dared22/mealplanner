import asyncio
import os
import sys
from pathlib import Path
from types import SimpleNamespace
from uuid import uuid4

import pytest
from fastapi import HTTPException
from fastapi.testclient import TestClient
from starlette.requests import Request


os.environ.setdefault(
    "DATABASE_URL", "postgresql://user:password@localhost:5432/mealplanner_test"
)

BACKEND_DIR = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(BACKEND_DIR))

from main import (
    AdminRecipeCreate,
    AdminRecipeDetail,
    AdminRecipeUpdate,
    PreferencePlanResponse,
    RecipeListResponse,
    _normalize_import_row,
    _recipe_to_dict,
    _resolve_import_columns,
    app,
    create_admin_recipe,
    current_user_dependency,
    get_session,
    get_preferences,
    import_admin_recipes,
    update_admin_recipe,
)
from models import Recipe
from planner import (
    PreferenceDTO,
    query_candidate_recipes,
)
from planning_policy import dietary_flag_truthy


class FakeSession:
    def __init__(self, preference):
        self.preference = preference

    def get(self, _model, _pref_id):
        return self.preference


class RecipeWriteSession:
    def __init__(self, recipe=None):
        self.recipe = recipe
        self.added = []

    def add(self, value):
        self.added.append(value)

    def commit(self):
        pass

    def refresh(self, _value):
        pass

    def rollback(self):
        pass

    def scalar(self, _statement):
        return None

    def get(self, _model, _recipe_id):
        return self.recipe

    def execute(self, _statement):
        return SimpleNamespace(mappings=lambda: SimpleNamespace(all=lambda: []))


def _admin_user():
    return SimpleNamespace(id=uuid4(), email="admin@example.test", username="admin")


def _csv_request(payload: bytes) -> Request:
    async def receive():
        return {"type": "http.request", "body": payload, "more_body": False}

    return Request(
        {
            "type": "http",
            "method": "POST",
            "path": "/admin/recipes/import",
            "headers": [
                (b"content-type", b"text/csv"),
                (b"x-file-name", b"recipes.csv"),
            ],
            "query_string": b"",
        },
        receive=receive,
    )


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


def test_recipe_import_normalizes_legacy_nutrition_and_dietary_aliases():
    row = {
        "Title": "Smoky lentil bowl",
        "Nutrition": '{"calories_kcal": 540, "protein": 28, "carbohydrates": 72, "fat": 12}',
        "Dietary Flags": '{"is_vegan": "true", "is_gluten_free": false}',
    }

    normalized = _normalize_import_row(row, _resolve_import_columns(row.keys()))

    assert normalized["nutrition"] == {
        "calories": 540,
        "protein_g": 28,
        "carbs_g": 72,
        "fat_g": 12,
    }
    assert normalized["dietary_flags"] == {"vegan": True, "gluten_free": False}


def test_planning_accepts_canonical_and_legacy_dietary_flags():
    assert dietary_flag_truthy({"vegan": True}, "is_vegan")
    assert dietary_flag_truthy({"is_vegan": "true"}, "is_vegan")
    assert not dietary_flag_truthy({"vegan": False}, "is_vegan")


def test_hybrid_planner_reads_canonical_import_nutrition():
    recipe = SimpleNamespace(
        id=uuid4(),
        title="Smoky lentil bowl",
        nutrition={"calories": 540, "protein_g": 28, "carbs_g": 72, "fat_g": 12},
        meal_type="dinner",
        ingredients=[],
        instructions=[],
        cuisine=None,
        dietary_flags=None,
        allergens=None,
        tags=[],
        cost_category=None,
        total_time_minutes=30,
        source_url=None,
    )
    session = SimpleNamespace(
        execute=lambda _statement: SimpleNamespace(scalars=lambda: SimpleNamespace(all=lambda: [recipe]))
    )
    dto = PreferenceDTO(
        age=None,
        gender=None,
        height_cm=None,
        weight_kg=None,
        activity_level=None,
        nutrition_goal=None,
        meals_per_day=None,
        budget_range=None,
        cooking_time_preference=None,
        dietary_restrictions=[],
        preferred_cuisines=[],
        language="en",
    )

    candidates = query_candidate_recipes(session, dto)

    assert candidates["dinner"][0] == {
        "id": recipe.id,
        "title": "Smoky lentil bowl",
        "meal_type": "dinner",
        "calories": 540.0,
        "protein": 28.0,
        "carbs": 72.0,
        "fat": 12.0,
        "ingredients": [],
        "instructions": [],
        "cuisine": None,
        "tags": [],
        "cost_category": None,
        "total_time_minutes": 30,
        "url": None,
    }

    assert query_candidate_recipes(session, dto, exclude_recipe_ids={recipe.id})["dinner"] == []


def test_admin_recipe_crud_models_expose_only_editor_fields():
    expected_detail_fields = {
        "id",
        "title",
        "slug",
        "source_url",
        "image_url",
        "description",
        "instructions",
        "ingredients",
        "cuisine",
        "meal_type",
        "nutrition",
        "tags",
        "created_at",
        "updated_at",
        "is_active",
    }
    expected_editable_fields = {
        "title",
        "ingredients",
        "instructions",
        "nutrition",
        "tags",
        "meal_type",
        "source_url",
        "image_url",
        "description",
        "cuisine",
    }

    assert set(AdminRecipeDetail.model_fields) == expected_detail_fields
    assert set(AdminRecipeCreate.model_fields) == expected_editable_fields
    assert set(AdminRecipeUpdate.model_fields) == expected_editable_fields | {"is_active"}


def test_admin_recipe_crud_normalizes_nutrition_without_persisting_legacy_fields():
    session = RecipeWriteSession()
    created = create_admin_recipe(
        AdminRecipeCreate(
            title="Lentil bowl",
            ingredients=["1 cup lentils"],
            instructions=["Cook lentils"],
            nutrition={"calories_kcal": 540, "protein": 28, "carbs": 72, "fat": 12},
            tags=["vegan"],
            meal_type="dinner",
        ),
        db=session,
        _admin=_admin_user(),
    )
    recipe = next(value for value in session.added if isinstance(value, Recipe))

    assert created.nutrition == {"calories": 540, "protein_g": 28, "carbs_g": 72, "fat_g": 12}
    assert recipe.nutrition == created.nutrition
    assert not hasattr(recipe, "category")

    session.recipe = recipe
    updated = update_admin_recipe(
        recipe.id,
        AdminRecipeUpdate(nutrition={"calories": 600, "protein_g": 30}),
        db=session,
        _admin=_admin_user(),
    )

    assert updated.nutrition == {"calories": 600, "protein_g": 30}
    assert recipe.nutrition == updated.nutrition


def test_csv_import_creates_a_recipe_with_canonical_import_fields():
    payload = (
        'Title,Meal Type,Nutrition,Dietary Flags,Allergens,Total Time\n'
        'Smoky lentil bowl,dinner,"{""calories_kcal"":540,""protein"":28}",'
        '"{""is_vegan"":true}",gluten,30\n'
    ).encode()
    session = RecipeWriteSession()

    response = asyncio.run(
        import_admin_recipes(_csv_request(payload), db=session, _admin=_admin_user())
    )
    recipe = next(value for value in session.added if isinstance(value, Recipe))

    assert response.model_dump() == {"created": 1, "updated": 0, "skipped": 0, "errors": []}
    assert recipe.nutrition == {"calories": 540, "protein_g": 28}
    assert recipe.dietary_flags == {"vegan": True}
    assert recipe.total_time_minutes == 30
