import pytest
from fastapi.testclient import TestClient
import time
import concurrent.futures

# Импортируем наше приложение из новой папки server
from server.app import app
from server.solver import sort_key

# Инициализируем тестовый клиент FastAPI (виртуальный браузер для тестов)
client = TestClient(app)

class Test01_FunctionalTesting:
    """1. Функциональное тестирование: полный цикл решения для эталонного ФИО."""
    def test_full_cycle(self):
        res = client.post("/api/solve", json={"fio": "Аскаров Юрий Витальевич", "rows": 5, "cols": 5})
        assert res.status_code == 200
        data = res.json()
        assert "start_matrix" in data
        assert "target_matrix" in data
        assert len(data["start_matrix"]) == 5
        assert len(data["start_matrix"][0]) == 5

class Test02_SafetyTesting:
    """2. Тестирование безопасности: защита инварианта букв (ничего не теряется)."""
    def test_no_letters_lost(self):
        res = client.post("/api/solve", json={"fio": "Муха", "rows": 3, "cols": 3})
        data = res.json()
        start_chars = sorted([c for row in data["start_matrix"] for c in row if c != "_"])
        target_chars = sorted([c for row in data["target_matrix"] for c in row if c != "_"])
        assert start_chars == target_chars
        assert len(data["moves"]) <= 1000  # Защита от бесконечного цикла (проверка лимита)

class Test03_SecurityTesting:
    """3. Тестирование защищенности: XSS и некорректные типы."""
    def test_xss_and_injection(self):
        # Проверяем, что XSS-скрипты воспринимаются просто как текст
        res = client.post("/api/solve", json={"fio": "<script>alert(1)</script>", "rows": 6, "cols": 6})
        assert res.status_code == 200
        
        # Защита от неправильных типов (строка вместо числа строк)
        res2 = client.post("/api/solve", json={"fio": "Тест", "rows": "five", "cols": 5})
        assert res2.status_code == 422

class Test04_CompatibilityTesting:
    """4. Тестирование совместимости: правильные заголовки и UTF-8."""
    def test_headers_and_utf8(self):
        res = client.get("/")
        assert res.status_code == 200
        assert "text/html" in res.headers["content-type"]
        assert "utf-8" in res.headers["content-type"].lower()

class Test05_GUITesting:
    """5. GUI тестирование: проверка наличия ключевых элементов в clientWEB/index.html."""
    def test_html_elements_present(self):
        with open("clientWEB/index.html", "r", encoding="utf-8") as f:
            html = f.read()
        assert 'id="board"' in html
        assert 'id="matrixSelect"' in html
        assert 'id="btnExport"' in html
        assert 'id="btnReset"' in html

class Test06_UsabilityTesting:
    """6. Тестирование удобства: проверка логики расчета площади поля в UI-скрипте."""
    def test_usability_area_calc(self):
        with open("clientWEB/js/ui.js", "r", encoding="utf-8") as f:
            js_code = f.read()
        # Проверяем, что в JS реализована формула (длина + 1)
        assert "const requiredArea = AppState.parsedTokens.length + 1" in js_code

class Test07_AccessibilityTesting:
    """7. Тестирование доступности (a11y): метки для скринридеров в разметке."""
    def test_a11y_attributes(self):
        with open("clientWEB/index.html", "r", encoding="utf-8") as f:
            html = f.read()
        assert 'aria-label=' in html
        assert 'role="dialog"' in html
        assert 'role="status"' in html

class Test08_Internationalization:
    """8. Интернационализация (i18n): поддержка кириллицы, латиницы и спецсимволов."""
    def test_i18n_alphabets(self):
        res = client.post("/api/solve", json={"fio": "Ёжик John Й", "rows": 5, "cols": 5, "uppercase": True})
        assert res.status_code == 200
        target = res.json()["target_matrix"]
        chars = [c for row in target for c in row if c not in ["_", ""]]
        assert "Ё" in chars
        assert "J" in chars

class Test09_PerformanceTesting:
    """9. Тестирование производительности: ответ должен быть быстрее 30 секунд."""
    def test_response_time(self):
        start = time.perf_counter()
        res = client.post("/api/solve", json={"fio": "Тест Производительности", "rows": 6, "cols": 6})
        duration = time.perf_counter() - start
        assert duration < 30.0  

class Test10_StressTesting:
    """10. Нагрузочное тестирование: параллельные многопоточные запросы."""
    def test_concurrent_requests(self):
        def make_req():
            return client.post("/api/solve", json={"fio": "Стресс" * 5, "rows": 12, "cols": 12})
        
        # Имитируем 5 одновременных пользователей
        with concurrent.futures.ThreadPoolExecutor(max_workers=5) as executor:
            futures = [executor.submit(make_req) for _ in range(5)]
            for future in futures:
                assert future.result().status_code == 200

class Test11_NegativeTesting:
    """11. Негативное тестирование: обработка нехватки места, превышения лимитов."""
    def test_invalid_inputs(self):
        # 21 буква на поле 4x4 (16 клеток) - должно отсекаться сервером
        res1 = client.post("/api/solve", json={"fio": "Аскаров Юрий Витальевич", "rows": 4, "cols": 4})
        assert res1.status_code == 400
        
        # Дробные числа (float) - отсекаются валидатором
        res2 = client.post("/api/solve", json={"fio": "Тест", "rows": 5.5, "cols": 5})
        assert res2.status_code == 422
        
        # Превышение лимита в 120 символов
        res3 = client.post("/api/solve", json={"fio": "А" * 121, "rows": 12, "cols": 12})
        assert res3.status_code == 400

class Test12_BlackBoxTesting:
    """12. Тестирование черного ящика: граничные значения размеров."""
    def test_boundaries(self):
        # Самое маленькое поле: 2x2 для 3 букв
        res1 = client.post("/api/solve", json={"fio": "АБВ", "rows": 2, "cols": 2})
        assert res1.status_code == 200
        # Максимально допустимое поле: 12x12 для 120 символов
        res2 = client.post("/api/solve", json={"fio": "А" * 120, "rows": 12, "cols": 12})
        assert res2.status_code == 200

class Test13_AutomatedTesting:
    """13. Автоматизированное тестирование: мета-тест, подтверждающий работу pytest."""
    def test_runner_works(self):
        assert True

class Test14_UnitComponentTesting:
    """14. Модульное тестирование: изолированная проверка функции сортировки."""
    def test_sorting_logic(self):
        chars = ["в", "А", "а", "В"]
        sorted_chars = sorted(chars, key=sort_key)
        assert sorted_chars == ["А", "а", "В", "в"]

class Test15_IntegrationTesting:
    """15. Интеграционное тестирование: сквозная проверка компонентов API и логики Мухи."""
    def test_api_to_matrix_integration(self):
        res = client.post("/api/solve", json={"fio": "Интеграция", "rows": 5, "cols": 5})
        data = res.json()
        assert "moves" in data
        assert isinstance(data["moves"], list)
        assert "stats" in data
        assert "synapses_used" in data["stats"]