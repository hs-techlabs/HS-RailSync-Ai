"""
Root Launcher for Indian Railways AI Automatic Block Planning System.
Delegates execution to backend/run_system.py.
"""

import os
import sys
import runpy

ROOT_DIR = os.path.abspath(os.path.dirname(__file__))
BACKEND_DIR = os.path.join(ROOT_DIR, "backend")
ENTRY_POINT = os.path.join(BACKEND_DIR, "run_system.py")

if __name__ == "__main__":
    if os.path.exists(ENTRY_POINT):
        os.chdir(BACKEND_DIR)
        runpy.run_path(ENTRY_POINT, run_name="__main__")
    else:
        print(f"Error: Backend entry point not found at {ENTRY_POINT}")
        sys.exit(1)
