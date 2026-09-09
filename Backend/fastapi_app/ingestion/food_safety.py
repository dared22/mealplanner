from __future__ import annotations

from .schemas import StorageGuidance


RULE_VERSION = "foodsafety-no-2026-01"

# Conservative suggestions derived from the Norwegian Food Safety Authority's
# general guidance. They are never treated as approved until an admin confirms.
DEFAULT_RULE = StorageGuidance(
    fridge_days=3,
    storage_instructions=(
        "Cool from 60°C to 10°C within two hours, divide into smaller containers, "
        "then seal and refrigerate below 4°C. Use within 2–4 days."
    ),
    reheating_instructions=(
        "Reheat only the portion being served to above 70°C throughout."
    ),
    rule_version=RULE_VERSION,
    sources=[
        "https://www.mattilsynet.no/mat-og-drikke/forbrukere/"
        "rad-for-oppbevaring-av-mat",
        "https://www.mattilsynet.no/mat-og-drikke/matservering/"
        "mathandtering-hygiene#kap-6-varm-mat-skal-vre-rykende-varm",
    ],
)


def suggested_storage() -> StorageGuidance:
    return DEFAULT_RULE.model_copy(deep=True)
