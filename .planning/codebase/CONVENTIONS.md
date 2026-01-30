# Coding Conventions

**Analysis Date:** 2026-01-26

## Naming Patterns

**Files:**
- React components: PascalCase with `.jsx` extension (e.g., `PersonalInfoStep.jsx`, `ResultsStep.jsx`)
- Python modules: snake_case (e.g., `clerk_auth.py`, `recipe_translator.py`, `planner.py`)
- Utility files: camelCase for JS utilities (e.g., `api.js`, `utils.js`)
- Directories: lowercase with hyphens or underscores (e.g., `components/questionnaire/`, `fastapi_app/`)

**Functions:**
- JavaScript/React: camelCase (e.g., `handleNumberChange`, `normalizeServerPlan`, `validatePersonalInfo`)
- Python: snake_case (e.g., `generate_daily_plan_for_preference`, `extract_primary_email`, `verify_session_token`)
- Private helpers: Leading underscore in both languages (e.g., `_normalize_preference`, `_json_safe`, `_generate_username`)

**Variables:**
- Constants: UPPER_SNAKE_CASE (e.g., `LANGUAGE_LABELS`, `SYSTEM_PROMPT`, `WEEK_DAYS`, `MEAL_ICONS`)
- Local variables: camelCase in JS, snake_case in Python
- Component props: camelCase (e.g., `onRestart`, `regenerateDisabled`, `showAgeError`)

**Types:**
- Python dataclasses: PascalCase (e.g., `PreferenceDTO`)
- TypeScript/JSDoc: PascalCase for types (not enforced but referenced in code comments)
- Pydantic models: PascalCase (e.g., `SessionResponse`, `User`, `Preference`, `Recipe`)

## Code Style

**Formatting:**
- JavaScript/React: No strict formatter configured, but uses consistent spacing
- Python: 4-space indentation (SQLAlchemy conventions)
- Line length: Typically 88-100 characters

**Linting:**
- ESLint configuration: `Frontend/eslint.config.js`
- Rules:
  - `no-unused-vars`: Error with pattern `^[A-Z_]` (ignores uppercase/underscore variables)
  - React Hooks recommended-latest configuration
  - React Refresh for Vite integration
- Python: No linter config detected, follows PEP 8 implicitly

## Import Organization

**Order:**
1. Built-in/standard library imports (e.g., `import os`, `import logging`)
2. Third-party imports (e.g., `import fastapi`, `import sqlalchemy`)
3. Local/relative imports (e.g., `from models import`, `from @/i18n/`)
4. Type imports separate from runtime imports in Python

**Path Aliases:**
- JavaScript: `@/` maps to `src/` directory (configured in `vite.config.js`)
- Python: Relative imports within `Backend/fastapi_app/`

Example (React):
```jsx
import React from 'react'
import { useLanguage } from '@/i18n/LanguageContext'
import { validatePersonalInfo } from './validation'
```

Example (Python):
```python
import logging
import os
from typing import Dict, Optional

from fastapi import FastAPI
from sqlalchemy.orm import Session

from models import User
from clerk_auth import verify_session_token
```

## Error Handling

**Patterns:**
- Python: Try/except with specific exception types, logging on error
  - Example: `except OpenAIError as exc:` then `logger.exception()`
  - HTTPException raised with status codes (400, 401, 403, 404)
  - Fallback values returned on failure (e.g., `{"plan": None, "error": str(exc)}`)

- JavaScript/React: No try/catch in components; error states managed via parent callbacks
  - Error messages passed via props (e.g., `errorMessage`, `status='error'`)
  - Validation functions return `{errors, isValid}` objects
  - Example: `validatePersonalInfo()` returns `{errors: {}, isValid: true}`

## Logging

**Framework:**
- Python: Built-in `logging` module with `logger = logging.getLogger(__name__)`
- JavaScript: `console` (no structured logging library)

**Patterns:**
- Python logs at INFO, WARNING, EXCEPTION levels
  - Info: Successful operations (e.g., "Generated meal plan for preference %s")
  - Exception: Caught errors with full traceback
  - Warning: Missing config or data (e.g., "OPENAI_API_KEY is not configured")

- JavaScript: No console logging in production code; debugging via state props

## Comments

**When to Comment:**
- Used sparingly; code is self-documenting
- Comments in Python for complex logic (e.g., Neon pooler handling in `database.py`)
- JSX comments for section markers in longer components (e.g., `{/* Header */}`, `{/* Loading State */}`)

**JSDoc/TSDoc:**
- Python docstrings: Single-line for simple functions
  - Example: `"""Normalize a Recipe ORM object into a JSON-serializable dict."""`
- JavaScript: No JSDoc used; types inferred from usage
- React: Comments above complex functions explaining parameters

## Function Design

**Size:**
- Python: Mix of short helpers (10-20 lines) and longer functions (50+ lines for planner logic)
- React: Components typically 50-150 lines with memo optimization
- Helper functions extracted: `validatePersonalInfo()`, `_normalize_preference()`, `_extract_json()`

**Parameters:**
- Python: Explicit parameters or `*args`/`**kwargs` for flexible payloads
  - Example: `def save_preferences(payload: Dict[str, Any] = Body(...), db: Session = Depends(...))`
- React: Props destructured in function signature
  - Example: `function PersonalInfoStep({ data, onChange }) {`
- Private functions use leading underscore

**Return Values:**
- Python: Dicts for structured responses (e.g., `{"plan": None, "error": str}`)
- React: void (side effects via callbacks) or values for utilities
- Validation functions return objects with multiple keys: `{errors, isValid}`

## Module Design

**Exports:**
- Python: All functions/classes at module level; no default exports
- JavaScript: Named exports for utilities, default exports for React components
  - Example: `export const validatePersonalInfo = () => {...}`
  - Example: `export default function PersonalInfoStep() {...}`

**Barrel Files:**
- Not used; direct imports from source files
- Example: Import from `@/i18n/LanguageContext` not from `@/i18n/index`

## API Response Pattern

**Consistency:**
All API responses follow a standard structure with status fields:
- Success: `{"id": ..., "stored": true, "plan": null, "plan_status": "pending"}`
- Error: `{"plan": None, "raw_text": None, "error": str(exc)}`
- Fetch: `{"id": ..., "plan_status": "...", "plan": {...}, "error": null, ...}`

---

*Convention analysis: 2026-01-26*
