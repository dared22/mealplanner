from __future__ import annotations

import os


TRUE_VALUES = {"1", "true", "yes"}


def imports_enabled() -> bool:
    return os.getenv("INSTAGRAM_IMPORTS_ENABLED", "false").strip().lower() in TRUE_VALUES
