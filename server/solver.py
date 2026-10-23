import os
import pandas as pd
from collections import deque
from typing import List, Tuple

# Измененный путь: ищем папку muha_mind в корне проекта (на уровень выше папки server)
FEATHER_PATH = os.path.join(os.path.dirname(__file__), "..", "muha_mind", "flywire_synapses_783.feather")

# =====================================================================
# 1. ЗАГРУЗКА МОЗГА МУХИ
# =====================================================================
def init_fly_brain():
    if not os.path.exists(FEATHER_PATH):
        print("Создаем резервный граф синапсов мухи для тестов...")
        os.makedirs(os.path.dirname(FEATHER_PATH), exist_ok=True)
        df = pd.DataFrame({
            "pre_pt_root_id": [1, 2, 3],
            "post_pt_root_id": [2, 3, 1],
            "weight": [0.9, 0.5, 0.2]
        })
        df.to_feather(FEATHER_PATH)
    try:
        df = pd.read_feather(FEATHER_PATH)
        print(f"Мозг мухи подключен. Нейронных связей: {len(df)}")
        return df
    except Exception as e:
        print(f"Ошибка загрузки мозга: {e}")
        return None

fly_brain = init_fly_brain()

def get_synapse_weights(count: int = 256) -> List[float]:
    if fly_brain is not None and len(fly_brain) > 0:
        sample = fly_brain.head(count)
        num_cols = sample.select_dtypes(include=["number"]).columns
        if len(num_cols) > 0:
            vals = sample[num_cols[-1]].abs().tolist()
            max_v = max(vals) if vals and max(vals) > 0 else 1.0
            return [float(v) / max_v for v in vals]
    return [0.5] * count

SYNAPSE_WEIGHTS = get_synapse_weights()

# =====================================================================
# 2. ПРАВИЛА СОРТИРОВКИ
# =====================================================================
RU_UPPER = "АБВГДЕЁЖЗИЙКЛМНОПРСТУФХЦЧШЩЪЫЬЭЮЯ"
RU_LOWER = "абвгдеёжзийклмнопрстуфхцчшщъыьэюя"
EN_UPPER = "ABCDEFGHIJKLMNOPQRSTUVWXYZ"
EN_LOWER = "abcdefghijklmnopqrstuvwxyz"

def sort_key(token: str):
    if token.isdigit():
        return (2, int(token), len(token), token)
    if len(token) == 1:
        if token in RU_UPPER: return (0, RU_UPPER.index(token), 0, token)
        if token in RU_LOWER: return (0, RU_LOWER.index(token), 1, token)
        if token in EN_UPPER: return (1, EN_UPPER.index(token), 0, token)
        if token in EN_LOWER: return (1, EN_LOWER.index(token), 1, token)
    return (3, ord(token[0]) if token else 0, 0, token)

# =====================================================================
# 3. АЛГОРИТМ РЕШЕНИЯ (ПОШАГОВЫЙ ПУТЬ МУХИ)
# =====================================================================
class MaxMovesReached(Exception):
    """Остановка алгоритма при превышении лимита ходов"""
    pass

def compute_fly_moves(start_mat: List[List[str]], target_mat: List[List[str]], max_moves: int) -> Tuple[List[dict], bool]:
    rows, cols = len(start_mat), len(start_mat[0])
    board = [row[:] for row in start_mat]
    moves: List[dict] = []
    locked = set()

    def record_slide(sr: int, sc: int, tr: int, tc: int):
        if len(moves) >= max_moves: raise MaxMovesReached()
        if abs(sr - tr) + abs(sc - tc) != 1 or board[tr][tc] != "_": return
        ch = board[sr][sc]
        board[tr][tc] = ch
        board[sr][sc] = "_"
        moves.append({"step": len(moves) + 1, "char": ch, "from": [sr, sc], "to": [tr, tc]})
        if len(moves) >= max_moves: raise MaxMovesReached()

    def bfs_path(start_pos, goal_cond, blocked_set):
        q = deque([[start_pos]])
        visited = {start_pos}
        while q:
            path = q.popleft()
            r, c = path[-1]
            if goal_cond(r, c): return path
            for dr, dc in [(-1, 0), (1, 0), (0, -1), (0, 1)]:
                nr, nc = r + dr, c + dc
                if 0 <= nr < rows and 0 <= nc < cols and (nr, nc) not in visited and (nr, nc) not in blocked_set:
                    visited.add((nr, nc))
                    q.append(path + [(nr, nc)])
        return None

    def bring_blank_to(tr: int, tc: int, forbidden: set) -> bool:
        if board[tr][tc] == "_": return True
        path = bfs_path((tr, tc), lambda r, c: board[r][c] == "_", forbidden)
        if not path: return False
        for i in range(len(path) - 1, 0, -1):
            blank_r, blank_c = path[i]
            tile_r, tile_c = path[i - 1]
            record_slide(tile_r, tile_c, blank_r, blank_c)
        return True

    def find_tile_with_synapses(ch: str, dest_r: int, dest_c: int, forbidden: set):
        candidates = []
        idx = 0
        for r in range(rows):
            for c in range(cols):
                if (r, c) not in forbidden and board[r][c] == ch:
                    dist = abs(r - dest_r) + abs(c - dest_c)
                    syn_w = SYNAPSE_WEIGHTS[idx % len(SYNAPSE_WEIGHTS)]
                    candidates.append((dist + syn_w * 0.1, r, c))
                    idx += 1
        if not candidates: return None
        candidates.sort()
        return (candidates[0][1], candidates[0][2])

    def move_tile_to(ch: str, dest_r: int, dest_c: int, extra_locked: set = set()) -> bool:
        if board[dest_r][dest_c] == ch: return True
        blocked = locked | extra_locked
        if ch == "_": return bring_blank_to(dest_r, dest_c, blocked)

        src = find_tile_with_synapses(ch, dest_r, dest_c, blocked)
        if not src: return False

        tile_path = bfs_path(src, lambda r, c: (r, c) == (dest_r, dest_c), blocked)
        if not tile_path: return False

        curr_r, curr_c = src
        for next_r, next_c in tile_path[1:]:
            if not bring_blank_to(next_r, next_c, blocked | {(curr_r, curr_c)}): return False
            record_slide(curr_r, curr_c, next_r, next_c)
            curr_r, curr_c = next_r, next_c
        return True

    def solve_pair(p1, p2, s1, s2):
        ch1, ch2 = target_mat[p1[0]][p1[1]], target_mat[p2[0]][p2[1]]
        if ch1 == "_" and ch2 == "_": return
        if ch2 == "_":
            move_tile_to(ch1, p1[0], p1[1]); locked.add(p1); return
        if ch1 == "_":
            move_tile_to(ch2, p2[0], p2[1]); locked.add(p2); return
        if board[p1[0]][p1[1]] == ch1 and board[p2[0]][p2[1]] == ch2:
            locked.add(p1); locked.add(p2); return

        if board[p2[0]][p2[1]] == ch1 or board[p1[0]][p1[1]] == ch1:
            bring_blank_to(s2[0], s2[1], locked | {p1, p2})
            if board[p2[0]][p2[1]] != "_" and board[s2[0]][s2[1]] == "_":
                record_slide(p2[0], p2[1], s2[0], s2[1])

        move_tile_to(ch2, p1[0], p1[1])
        avail_ch1 = [(r, c) for r in range(rows) for c in range(cols) if (r, c) not in (locked | {p1, p2}) and board[r][c] == ch1]
        
        if not avail_ch1 and board[p2[0]][p2[1]] == ch1:
            if bring_blank_to(s2[0], s2[1], locked | {p1, p2}):
                record_slide(p2[0], p2[1], s2[0], s2[1])
            else:
                bring_blank_to(s1[0], s1[1], locked | {p1, p2})
                record_slide(p1[0], p1[1], s1[0], s1[1])
                record_slide(p2[0], p2[1], p1[0], p1[1])
                move_tile_to(ch2, p1[0], p1[1], {p2})

        move_tile_to(ch1, s1[0], s1[1], {p1})
        if bring_blank_to(p2[0], p2[1], locked | {p1, s1}):
            record_slide(p1[0], p1[1], p2[0], p2[1])
            record_slide(s1[0], s1[1], p1[0], p1[1])
            locked.add(p1); locked.add(p2)

    try:
        if rows >= 2 and cols >= 2:
            for c in range(cols - 2):
                if board == target_mat: break
                for r in range(rows - 2):
                    ch = target_mat[r][c]
                    if ch != "_":
                        move_tile_to(ch, r, c); locked.add((r, c))
                solve_pair((rows - 2, c), (rows - 1, c), (rows - 2, c + 1), (rows - 1, c + 1))

            c1, c2 = cols - 2, cols - 1
            for r in range(rows - 2):
                if board == target_mat: break
                solve_pair((r, c1), (r, c2), (r + 1, c1), (r + 1, c2))

            if board != target_mat:
                rem_cells = [(rows - 2, cols - 2), (rows - 2, cols - 1), (rows - 1, cols - 2), (rows - 1, cols - 1)]
                for r, c in rem_cells:
                    ch = target_mat[r][c]
                    if ch != "_" and ch not in [board[rr][cc] for rr, cc in rem_cells]:
                        move_tile_to(ch, r, c)
                if not any(board[r][c] == "_" for r, c in rem_cells):
                    bring_blank_to(rows - 1, cols - 1, locked)

                rem_set, target_tuple, start_tuple = set(rem_cells), tuple(target_mat[r][c] for r, c in rem_cells), tuple(board[r][c] for r, c in rem_cells)
                q, visited_states, found_seq = deque([(start_tuple, [])]), {start_tuple}, None

                while q:
                    curr_state, seq = q.popleft()
                    if curr_state == target_tuple:
                        found_seq = seq; break
                    if len(seq) >= 16: continue
                    state_map = {rem_cells[i]: curr_state[i] for i in range(4)}
                    for pos, val in state_map.items():
                        if val == "_":
                            br, bc = pos
                            for dr, dc in [(-1, 0), (1, 0), (0, -1), (0, 1)]:
                                nr, nc = br + dr, bc + dc
                                if (nr, nc) in rem_set and state_map[(nr, nc)] != "_":
                                    next_map = dict(state_map)
                                    next_map[(br, bc)], next_map[(nr, nc)] = next_map[(nr, nc)], "_"
                                    next_tuple = tuple(next_map[p] for p in rem_cells)
                                    if next_tuple not in visited_states:
                                        visited_states.add(next_tuple)
                                        q.append((next_tuple, seq + [((nr, nc), (br, bc))]))
                if found_seq:
                    for (sr, sc), (tr, tc) in found_seq: record_slide(sr, sc, tr, tc)
    except MaxMovesReached:
        pass

    return moves, board == target_mat