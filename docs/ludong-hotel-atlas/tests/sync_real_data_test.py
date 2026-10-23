import importlib.util
from pathlib import Path


APP_DIR = Path(__file__).resolve().parents[1]
SCRIPT_PATH = APP_DIR / "scripts" / "sync_real_data.py"
WORKBENCH_PATH = APP_DIR.parent / "workbench_ludong.html"
SCORE_PATH = APP_DIR.parent / "downloads" / "经营分_鲁东省区_2026-10-20.xlsx"
ORG_PATH = Path(
    "/Users/bytedance/.trae-cn/attachments/"
    "fb6cb173-dd31-49d7-9405-706a92c935bf_"
    "c79f7fa4-db40-4a8a-ba9e-c0604102b106_1018-2026-10-18 14-51-32.xlsx"
)
REGISTRY_PATH = APP_DIR / "data" / "ludong-hotel-registry.json"


assert SCRIPT_PATH.exists(), "real-data synchronization script must exist"

spec = importlib.util.spec_from_file_location("sync_real_data", SCRIPT_PATH)
sync_real_data = importlib.util.module_from_spec(spec)
spec.loader.exec_module(sync_real_data)

result = sync_real_data.build_dataset(
    workbench_path=WORKBENCH_PATH,
    score_path=SCORE_PATH,
    organization_path=ORG_PATH,
    registry_path=REGISTRY_PATH,
)

assert result["meta"]["asOf"] == "2026-10-20"
assert result["meta"]["period"] == "2026-10-14 至 2026-10-20"
assert result["meta"]["count"] == 387
assert result["meta"]["scoreMatches"] == 329
assert result["meta"]["scoreMissing"] == 58
assert len(result["hotels"]) == 387
assert len({hotel["district"] for hotel in result["hotels"]}) == 10

missing = [
    hotel for hotel in result["hotels"]
    if hotel["operationScore"] is None
]
assert len(missing) == 58
assert all(hotel["operationScore"] is None for hotel in missing)
assert all(hotel["scoreDelta"] is None for hotel in missing)
assert all(hotel["poiId"] for hotel in result["hotels"])
assert all(hotel["name"] and hotel["name"] != "#N/A" for hotel in result["hotels"])

located = [
    hotel for hotel in result["hotels"]
    if hotel["lng"] is not None and hotel["lat"] is not None
]
assert len(located) >= 320
assert all(117.0 <= hotel["lng"] <= 123.5 for hotel in located)
assert all(34.0 <= hotel["lat"] <= 39.5 for hotel in located)

print("PASS sync_real_data_test.py")
