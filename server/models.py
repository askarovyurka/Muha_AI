# Схемы данных

from typing import List, Optional
from pydantic import BaseModel, StrictInt

class SolveRequest(BaseModel):
    """Схема ожидаемого JSON-запроса от клиента."""
    fio: str = ""
    rows: StrictInt
    cols: StrictInt
    uppercase: bool = True
    items: Optional[List[str]] = None
    current_matrix: Optional[List[List[str]]] = None
    max_moves: int = 1000  # Базовый лимит ходов для мухи