import os
import sys
import unittest
from pathlib import Path
from unittest import mock
from uuid import uuid4

from fastapi import BackgroundTasks


APP_DIR = Path(__file__).resolve().parents[1]
if str(APP_DIR) not in sys.path:
    sys.path.insert(0, str(APP_DIR))

os.environ.setdefault(
    "DATABASE_URL", "postgresql://postgres:postgres@localhost/mealplanner_test"
)

from main import save_preferences  # noqa: E402
from models import Preference, User  # noqa: E402
from planner import apply_carry_forward_leftovers, _format_db_recipe_as_meal  # noqa: E402


class _FakeSession:
    def __init__(self) -> None:
        self.preference = None

    def add(self, obj) -> None:
        if isinstance(obj, Preference):
            self.preference = obj

    def commit(self) -> None:
        return None

    def refresh(self, obj) -> None:
        if getattr(obj, "id", None) is None:
            obj.id = 101


class CarryForwardTests(unittest.TestCase):
    def test_save_preferences_persists_carry_forward_enabled(self) -> None:
        user_id = uuid4()
        user = User(id=user_id, username="tester", email="tester@example.com")
        db = _FakeSession()
        background_tasks = BackgroundTasks()

        response = save_preferences(
            background_tasks=background_tasks,
            payload={
                "user_id": str(user_id),
                "age": 30,
                "height": 180,
                "weight": 80,
                "activity_level": "moderately_active",
                "nutrition_goal": "maintain_weight",
                "meals_per_day": 3,
                "budget_range": "moderate",
                "cooking_time_preference": "30_60_min",
                "dietary_restrictions": ["none"],
                "preferred_cuisines": ["Italian"],
                "carry_forward_enabled": True,
            },
            db=db,
            current_user=user,
        )

        self.assertIsNotNone(db.preference)
        self.assertTrue(db.preference.raw_data["carry_forward_enabled"])
        self.assertEqual(response["id"], 101)
        self.assertEqual(response["plan_status"], "pending")
        self.assertEqual(len(background_tasks.tasks), 1)

    def test_apply_carry_forward_leftovers_reuses_previous_dinner(self) -> None:
        dinner_recipe_id = str(uuid4())
        lunch_recipe_id = str(uuid4())
        plan = {
            "calorieTarget": 2000,
            "macroTargets": {"protein": 150, "carbs": 200, "fat": 70},
            "days": [
                {
                    "name": "Monday",
                    "calories": 1700,
                    "macros": {"protein": 120, "carbs": 150, "fat": 60},
                    "meals": {
                        "Breakfast": {
                            "id": str(uuid4()),
                            "name": "Oats",
                            "calories": 400,
                            "protein": 20,
                            "carbs": 50,
                            "fat": 10,
                        },
                        "Lunch": {
                            "id": str(uuid4()),
                            "name": "Salad",
                            "calories": 500,
                            "protein": 35,
                            "carbs": 40,
                            "fat": 20,
                        },
                        "Dinner": {
                            "id": dinner_recipe_id,
                            "name": "Chili",
                            "calories": 800,
                            "protein": 65,
                            "carbs": 60,
                            "fat": 30,
                            "ingredients": [
                                {"name": "minced beef", "quantity": 150, "unit": "g"},
                                {"name": "beans", "quantity": 0.5, "unit": "box"},
                            ],
                            "ingredient_servings": 1,
                        },
                        "Snacks": None,
                    },
                },
                {
                    "name": "Tuesday",
                    "calories": 1600,
                    "macros": {"protein": 115, "carbs": 140, "fat": 55},
                    "meals": {
                        "Breakfast": {
                            "id": str(uuid4()),
                            "name": "Yogurt",
                            "calories": 350,
                            "protein": 25,
                            "carbs": 35,
                            "fat": 10,
                        },
                        "Lunch": {
                            "id": lunch_recipe_id,
                            "name": "Wrap",
                            "calories": 450,
                            "protein": 30,
                            "carbs": 45,
                            "fat": 15,
                        },
                        "Dinner": {
                            "id": str(uuid4()),
                            "name": "Fish",
                            "calories": 800,
                            "protein": 60,
                            "carbs": 60,
                            "fat": 30,
                        },
                        "Snacks": None,
                    },
                },
            ],
        }

        with mock.patch(
            "planner._load_recipe_portions_map", return_value={dinner_recipe_id: 4}
        ):
            updated = apply_carry_forward_leftovers(
                plan,
                {"carry_forward_enabled": True},
                db=object(),
            )

        monday_dinner = updated["days"][0]["meals"]["Dinner"]
        tuesday_lunch = updated["days"][1]["meals"]["Lunch"]

        self.assertEqual(monday_dinner["cook_servings"], 2)
        self.assertEqual(monday_dinner["servings_eaten"], 1)
        self.assertEqual(monday_dinner["ingredient_servings"], 2)
        self.assertEqual(monday_dinner["ingredients"][0]["quantity"], 300)
        self.assertEqual(monday_dinner["ingredients"][1]["quantity"], 1)
        self.assertFalse(monday_dinner["is_leftover"])

        self.assertTrue(tuesday_lunch["is_leftover"])
        self.assertEqual(tuesday_lunch["leftover_from_day"], "Monday")
        self.assertEqual(tuesday_lunch["leftover_from_meal_type"], "Dinner")
        self.assertEqual(tuesday_lunch["source_recipe_id"], dinner_recipe_id)
        self.assertEqual(tuesday_lunch["id"], dinner_recipe_id)
        self.assertEqual(tuesday_lunch["name"], "Chili")
        self.assertEqual(tuesday_lunch["calories"], 800)
        self.assertEqual(tuesday_lunch["ingredient_servings"], 1)
        self.assertEqual(tuesday_lunch["ingredients"][0]["quantity"], 150)
        self.assertEqual(tuesday_lunch["ingredients"][1]["quantity"], 0.5)

    def test_apply_carry_forward_leftovers_adds_default_metadata(self) -> None:
        recipe_id = str(uuid4())
        plan = {
            "calorieTarget": 1800,
            "macroTargets": {"protein": 130, "carbs": 180, "fat": 60},
            "days": [
                {
                    "name": "Monday",
                    "calories": 600,
                    "macros": {"protein": 30, "carbs": 50, "fat": 20},
                    "meals": {
                        "Breakfast": {
                            "id": recipe_id,
                            "name": "Egg Toast",
                            "calories": 600,
                            "protein": 30,
                            "carbs": 50,
                            "fat": 20,
                        },
                        "Lunch": None,
                        "Dinner": None,
                        "Snacks": None,
                    },
                }
            ],
        }

        updated = apply_carry_forward_leftovers(plan, {"carry_forward_enabled": False})
        breakfast = updated["days"][0]["meals"]["Breakfast"]

        self.assertEqual(breakfast["source_recipe_id"], recipe_id)
        self.assertFalse(breakfast["is_leftover"])
        self.assertIsNone(breakfast["leftover_from_day"])
        self.assertIsNone(breakfast["leftover_from_meal_type"])
        self.assertEqual(breakfast["cook_servings"], 1)
        self.assertEqual(breakfast["servings_eaten"], 1)

    def test_db_recipe_ingredients_are_scaled_to_one_serving(self) -> None:
        meal = _format_db_recipe_as_meal(
            {
                "id": str(uuid4()),
                "title": "Chili",
                "meal_type": "dinner",
                "calories": 800,
                "protein": 60,
                "carbs": 50,
                "fat": 25,
                "ingredients": [
                    {"name": "minced beef", "quantity": 600, "unit": "g"},
                    {"name": "kidney beans", "quantity": 2, "unit": "box"},
                    {"name": "salt", "quantity": 1.5, "unit": "ts"},
                ],
                "instructions": ["Cook everything together."],
                "tags": ["comfort"],
                "portions": 4,
            }
        )

        ingredients = meal["ingredients"]

        self.assertEqual(meal["recipe_portions"], 4)
        self.assertEqual(meal["ingredient_servings"], 1)
        self.assertEqual(ingredients[0]["quantity"], 150)
        self.assertEqual(ingredients[1]["quantity"], 0.5)
        self.assertEqual(ingredients[2]["quantity"], 0.38)


if __name__ == "__main__":
    unittest.main()
