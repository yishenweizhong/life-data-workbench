import importlib.util
from pathlib import Path


APP_DIR = Path(__file__).resolve().parents[1]
SCRIPT_PATH = APP_DIR / "scripts" / "sync_real_data.py"
WORKBENCH_PATH = APP_DIR.parent / "workbench_jinhe.html"
SCORE_PATH = APP_DIR.parent / "downloads" / "经营分_津河省区_2026-10-20.xlsx"
REGISTRY_PATH = APP_DIR / "data" / "tianjin-hotels.json"


assert SCRIPT_PATH.exists(), "real-data synchronization script must exist"

spec = importlib.util.spec_from_file_location("sync_real_data", SCRIPT_PATH)
sync_real_data = importlib.util.module_from_spec(spec)
spec.loader.exec_module(sync_real_data)

result = sync_real_data.build_dataset(
    workbench_path=WORKBENCH_PATH,
    score_path=SCORE_PATH,
    registry_path=REGISTRY_PATH,
)

assert result["meta"]["asOf"] == "2026-10-20"
assert result["meta"]["period"] == "2026-10-14 至 2026-10-20"
assert result["meta"]["count"] == 169
assert result["meta"]["storeMatches"] == 169
assert result["meta"]["scoreMatches"] == 169
assert len(result["hotels"]) == 169

assert all(hotel["poiId"] for hotel in result["hotels"])
assert all(isinstance(hotel["lng"], (int, float)) for hotel in result["hotels"])
assert all(isinstance(hotel["lat"], (int, float)) for hotel in result["hotels"])
assert all("status" not in hotel for hotel in result["hotels"])
assert all("tier" not in hotel for hotel in result["hotels"])
assert all("tags" not in hotel for hotel in result["hotels"])
assert all("note" not in hotel for hotel in result["hotels"])

yuhai = [
    hotel
    for hotel in result["hotels"]
    if hotel["provider"] == "北京昱海黑科技有限公司"
]
assert len(yuhai) == 39

print("PASS sync_real_data_test.py")
