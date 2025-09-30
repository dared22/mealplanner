from datetime import datetime
from typing import Any, Dict
import uuid

from fastapi import FastAPI, HTTPException

app = FastAPI(title="Meal Planner API")

# In-memory store for collected preferences keyed by a generated identifier
preferences_store: Dict[str, Dict[str, Any]] = {}


@app.get("/health")
def health_check() -> Dict[str, str]:
    return {"status": "ok"}


@app.post("/preferences")
def save_preferences(payload: Dict[str, Any]) -> Dict[str, Any]:
    if not payload:
        raise HTTPException(status_code=400, detail="Request body cannot be empty")

    pref_id = str(uuid.uuid4())

    preferences_store[pref_id] = {
        "id": pref_id,
        "submitted_at": datetime.utcnow().isoformat() + "Z",
        "data": payload,
    }

    return {"id": pref_id, "stored": True}


@app.get("/preferences/{pref_id}")
def get_preferences(pref_id: str) -> Dict[str, Any]:
    entry = preferences_store.get(pref_id)
    if entry is None:
        raise HTTPException(status_code=404, detail="Preferences not found")

    return entry
