import subprocess

import os
from fastapi import FastAPI, HTTPException
from fastapi.responses import FileResponse
from .models import SolveRequest
from .solver import compute_fly_moves, sort_key, fly_brain

app = FastAPI()

# =====================================================================
# 1. РАЗДАЧА СТАТИКИ ИЗ clientWEB/ (на уровень выше папки server)
# =====================================================================
BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
WEB_DIR = os.path.join(BASE_DIR, "clientWEB")

def resolve_web_file(filename: str) -> str:
    candidate = os.path.join(WEB_DIR, filename)
    if os.path.exists(candidate):
        return candidate
    return filename

@app.get("/")
def read_root():
    return FileResponse(resolve_web_file("index.html"))

@app.get("/style.css")
def get_css():
    return FileResponse(resolve_web_file("style.css"), media_type="text/css")

@app.get("/js/{script_name}")
def get_js(script_name: str):
    candidate = os.path.join(WEB_DIR, "js", script_name)
    if os.path.exists(candidate):
        return FileResponse(candidate, media_type="application/javascript")
    raise HTTPException(status_code=404, detail="Script not found")

# =====================================================================
# 2. ОСНОВНОЙ API ЭНДПОИНТ МУХИ
# =====================================================================
@app.post("/api/solve")
def solve_puzzle(req: SolveRequest):
    if not (2 <= req.rows <= 12 and 2 <= req.cols <= 12):
        raise HTTPException(status_code=400, detail="ошибка ввода")

    if req.current_matrix and len(req.current_matrix) == req.rows and len(req.current_matrix[0]) == req.cols:
        start_matrix = [[str(cell) for cell in row] for row in req.current_matrix]
        chars = [cell for row in start_matrix for cell in row if cell != "_"]
    elif req.items is not None and len(req.items) > 0:
        chars = [str(x).upper() if (req.uppercase and not str(x).isdigit()) else str(x) for x in req.items]
        if not (2 <= len(chars) <= 120) or req.rows * req.cols < len(chars) + 1:
            raise HTTPException(status_code=400, detail="ошибка ввода")
        start_matrix = [["" for _ in range(req.cols)] for _ in range(req.rows)]
        idx = 0
        for r in range(req.rows):
            for c in range(req.cols):
                start_matrix[r][c] = chars[idx] if idx < len(chars) else "_"
                idx += 1
    else:
        clean_fio = req.fio.replace(" ", "")
        if not (2 <= len(clean_fio) <= 120) or req.rows * req.cols < len(clean_fio) + 1:
            raise HTTPException(status_code=400, detail="ошибка ввода")
        if req.uppercase:
            clean_fio = clean_fio.upper()
        chars = list(clean_fio)
        start_matrix = [["" for _ in range(req.cols)] for _ in range(req.rows)]
        idx = 0
        for r in range(req.rows):
            for c in range(req.cols):
                start_matrix[r][c] = chars[idx] if idx < len(chars) else "_"
                idx += 1

    sorted_chars = sorted(chars, key=sort_key)
    target_matrix = [["" for _ in range(req.cols)] for _ in range(req.rows)]
    blanks_count = (req.rows * req.cols) - len(chars)
    blanks_placed = 0

    for c in range(req.cols - 1, -1, -1):
        for r in range(req.rows - 1, -1, -1):
            if blanks_placed < blanks_count:
                target_matrix[r][c] = "_"
                blanks_placed += 1

    char_idx = 0
    for r in range(req.rows):
        for c in range(req.cols):
            if target_matrix[r][c] == "":
                target_matrix[r][c] = sorted_chars[char_idx]
                char_idx += 1

    moves, is_solved = compute_fly_moves(start_matrix, target_matrix, req.max_moves)

    return {
        "start_matrix": start_matrix,
        "target_matrix": target_matrix,
        "moves": moves,
        "is_solved": is_solved,
        "stats": {"synapses_used": len(fly_brain) if fly_brain is not None else 0}
    }


# =====================================================================
# 3. маршрут, который будет вызывать pytest как подпроцесс:
# =====================================================================

@app.get("/api/run-tests")
def run_tests():
    try:
        result = subprocess.run(
            ["pytest", "test_all.py", "-v", "--disable-warnings"],
            capture_output=True,
            text=True,
            encoding="utf-8"
        )
        return {"output": result.stdout, "success": result.returncode == 0}
    except Exception as e:
        return {"output": str(e), "success": False}