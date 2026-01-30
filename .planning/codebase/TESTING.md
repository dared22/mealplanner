# Testing Patterns

**Analysis Date:** 2026-01-26

## Test Framework

**Runner:**
- No test runner detected in codebase
- `package.json` has no test script; no `jest.config.js`, `vitest.config.js`, or similar
- `requirements.txt` (Backend) has no pytest or testing dependencies
- **Status: No automated tests configured**

**Assertion Library:**
- Not applicable (no test framework)

**Run Commands:**
```bash
# No test commands currently available
# Frontend: npm test would need to be configured
# Backend: python -m pytest would need to be configured
```

## Test File Organization

**Location:**
- No test files found in codebase
- Pattern would be: `__tests__/` directories or `.test.js`/`.spec.js` files co-located with components
- Python would typically use `tests/` directory at project root

**Naming:**
- Not established (no tests exist)
- Recommended: `ComponentName.test.jsx`, `module_name_test.py`

**Structure:**
- Tests would follow directory structure of source code

## Test Structure

**Suite Organization:**
- No examples in codebase
- Based on patterns observed, would follow:

```typescript
// React component test pattern (recommended for this codebase):
import { render, screen, fireEvent } from '@testing-library/react'
import PersonalInfoStep from '@/components/questionnaire/PersonalInfoStep'

describe('PersonalInfoStep', () => {
  it('validates age range', () => {
    // Test implementation
  })
})
```

```python
# Python test pattern (recommended for this codebase):
import pytest
from unittest.mock import patch, MagicMock
from fastapi.testclient import TestClient
from main import app

def test_save_preferences_requires_auth():
    # Test implementation
    pass
```

**Patterns:**
- Setup: Not established (no fixtures or factories)
- Teardown: Not established
- Assertion: Not established

## Mocking

**Framework:**
- Not in use; no testing library installed

**Patterns:**
- Would use `unittest.mock` for Python backend tests
- Would use `jest.mock()` or testing library for React component tests

**What to Mock:**
- External API calls (OpenAI API in `planner.py`)
- Database operations (SQLAlchemy sessions)
- Clerk authentication in API tests
- HTTP requests in frontend tests

**What NOT to Mock:**
- Utility functions like `_normalize_preference()` or `validatePersonalInfo()`
- Local state management
- UI component rendering

## Fixtures and Factories

**Test Data:**
- No fixtures exist in codebase
- Pattern would be:

```python
# Backend factory pattern (recommended):
@pytest.fixture
def sample_preference():
    return {
        "age": 30,
        "gender": "male",
        "height": 175,
        "weight": 75,
        "activity_level": "moderately_active",
        "nutrition_goal": "lose_weight",
        "meals_per_day": 3,
        "budget_range": "moderate",
        "cooking_time_preference": "20-30 min",
        "dietary_restrictions": [],
        "preferred_cuisines": ["Italian", "Asian"]
    }
```

```jsx
// React test data (recommended):
const mockUserPreferences = {
  age: 25,
  gender: 'female',
  height: 165,
  weight: 60
}
```

**Location:**
- Would be: `tests/fixtures/` or `__tests__/mocks/`

## Coverage

**Requirements:**
- Not enforced; no coverage tools detected
- **Recommendation:** Add pytest-cov for Python, c8 for JavaScript

**View Coverage:**
```bash
# Backend (once pytest is configured):
python -m pytest --cov=fastapi_app tests/

# Frontend (once vitest/jest is configured):
npm run test:coverage
```

## Test Types

**Unit Tests:**
- **Scope:** Individual functions and utility functions
- **Approach (recommended):**
  - Python: Test each function in `planner.py`, `clerk_auth.py`, `models.py`
  - React: Test validation functions like `validatePersonalInfo()` separately from components

Example targets:
- `validatePersonalInfo()` - Test validation logic independently
- `_normalize_preference()` - Test preference transformation
- `_extract_json()` - Test JSON parsing robustness
- `generateSessionResponse()` - Test response structure

**Integration Tests:**
- **Scope:** API endpoints and component + hook interactions
- **Approach (recommended):**
  - Python: Use `TestClient(app)` to test full request/response cycles
  - React: Test form submission with mock API responses

Example targets:
- POST `/preferences` with various payloads
- GET `/preferences/{id}` with polling behavior
- Authentication flow (Clerk token verification)
- Language-based translation triggering

**E2E Tests:**
- **Framework:** Not used
- **Recommended:** Playwright or Cypress if full end-to-end testing needed
- Would test: Complete user journey from questionnaire through meal plan generation

## Common Patterns

**Async Testing:**
- Not established (no tests exist)
- Python recommendation:
```python
@pytest.mark.asyncio
async def test_plan_generation():
    result = await generate_daily_plan_for_preference(db, pref_id)
    assert result.get('plan') is not None
```

- React recommendation:
```jsx
it('loads meal plan on mount', async () => {
  render(<ResultsStep status='loading' />)
  await waitFor(() => {
    expect(screen.getByText(/Your meal plan/i)).toBeInTheDocument()
  })
})
```

**Error Testing:**
- Python approach (not yet implemented):
```python
def test_invalid_preferences_returns_400():
    response = client.post('/preferences', json={})
    assert response.status_code == 400
    assert 'Request body cannot be empty' in response.json()['detail']
```

- React approach (not yet implemented):
```jsx
it('displays validation error for invalid age', () => {
  const { errors } = validatePersonalInfo({ age: 5 })
  expect(errors.age).toContain('between 10 and 100')
})
```

## Test Data Scenarios

**Key test cases to implement (when tests are added):**

**Backend - Preference Validation:**
- Valid preference submission
- Missing required fields
- Invalid age range (< 10, > 100)
- Invalid height/weight combinations (BMI logic)
- Dietary restrictions handling (array)
- Language normalization (en/no/nb/nn)

**Backend - Authentication:**
- Valid Clerk JWT token
- Expired token
- Invalid signature
- Missing Authorization header
- New user creation on first login
- Existing user update

**Frontend - Form Validation:**
- Number field parsing (decimals, edge values)
- Gender selection requirement
- Cross-field validation (BMI check)
- Error message display timing
- Form submission with valid data

**Frontend - Results Display:**
- Plan normalization from server format
- Day carousel navigation
- Meal swap functionality
- Translation status polling
- Error state display

---

*Testing analysis: 2026-01-26*
