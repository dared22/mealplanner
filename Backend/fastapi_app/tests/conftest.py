import os
import sys

# planner.py / solver.py import models.py, which imports database.py, which
# raises at import time if DATABASE_URL isn't set. These tests only exercise
# pure functions (no real queries), so a placeholder DSN is enough to let the
# modules import; SQLAlchemy's create_engine doesn't connect until used.
os.environ.setdefault("DATABASE_URL", "postgresql://test:test@localhost/test")

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
