from ingestion.schemas import CandidateRecipeData, CreatorCreate, approval_blockers


def test_creator_requires_an_instagram_profile_and_normalizes_domains():
    creator = CreatorCreate(
        profile_url="https://www.instagram.com/mealprepchef/",
        allowed_domains=["HTTPS://Example.com", "example.com"],
        permission_basis="Written creator permission for recipe and thumbnail use",
        permission_confirmed=True,
    )

    assert creator.username == "mealprepchef"
    assert creator.allowed_domains == ["example.com"]


def test_approval_blockers_never_allow_missing_numeric_or_safety_fields():
    candidate = CandidateRecipeData(
        title="Chicken bowls",
        ingredients=[{"name": "chicken", "quantity": None, "unit": "g"}],
        instructions=["Cook the chicken."],
        source_url="https://www.instagram.com/p/example/",
        attribution="@mealprepchef",
    )

    assert approval_blockers(candidate) == [
        "ingredient_quantities",
        "batch_yield",
        "meal_type",
        "per_serving_macros",
        "storage_instructions",
        "reheating_instructions",
        "thumbnail",
        "allergen_review",
        "dietary_review",
        "food_safety_confirmation",
    ]


def test_approval_requires_supported_meal_type_and_trusted_provenance_urls():
    candidate = CandidateRecipeData(
        title="Chicken bowls",
        ingredients=[{"name": "chicken", "quantity": 800, "unit": "g"}],
        instructions=["Cook the chicken."],
        portions=4,
        meal_type="brunch",
        nutrition_per_serving={
            "calories": 520,
            "protein_g": 48,
            "carbs_g": 52,
            "fat_g": 13,
        },
        storage={
            "storage_instructions": "Refrigerate promptly.",
            "reheating_instructions": "Reheat until steaming.",
        },
        source_url="https://example.com/copied-recipe",
        attribution="@mealprepchef",
        thumbnail_url="https://example.com/unlicensed-image.jpg",
        allergen_reviewed=True,
        dietary_reviewed=True,
        food_safety_confirmed=True,
    )

    assert approval_blockers(candidate) == ["meal_type", "source_url", "thumbnail"]


def test_zero_calorie_recipe_cannot_be_approved_into_the_planner_pool():
    candidate = CandidateRecipeData(
        title="Zero calorie data error",
        ingredients=[{"name": "chicken", "quantity": 800, "unit": "g"}],
        instructions=["Cook the chicken."],
        portions=4,
        meal_type="lunch",
        nutrition_per_serving={
            "calories": 0,
            "protein_g": 48,
            "carbs_g": 52,
            "fat_g": 13,
        },
        storage={
            "storage_instructions": "Refrigerate promptly.",
            "reheating_instructions": "Reheat until steaming.",
        },
        source_url="https://www.instagram.com/p/example/",
        attribution="@mealprepchef",
        thumbnail_url="https://res.cloudinary.com/demo/image/upload/example.jpg",
        allergen_reviewed=True,
        dietary_reviewed=True,
        food_safety_confirmed=True,
    )

    assert approval_blockers(candidate) == ["per_serving_macros"]
