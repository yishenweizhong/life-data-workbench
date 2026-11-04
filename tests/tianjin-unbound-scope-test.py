import csv
import io
import json
from pathlib import Path
import unittest

REPO = Path(__file__).resolve().parents[1]
SOURCE = REPO / "docs/tianjin-hotel-atlas"
TARGET = REPO / "docs/tianjin-unbound-hotel-atlas"


class UnboundScopeTest(unittest.TestCase):
    def test_share_files_physically_exclude_bound_stores(self):
        source = json.loads((SOURCE / "data/tianjin-hotels.json").read_text())
        expected = [h for h in source["hotels"] if h["provider"] == "未绑定服务商"]
        data = json.loads((TARGET / "data/tianjin-hotels.json").read_text())
        self.assertEqual(data["hotels"], expected)
        seed = (TARGET / "real-data.js").read_text().split("var HOTEL_SEED = ", 1)[1]
        self.assertEqual(json.loads(seed.strip().removesuffix(";")), expected)
        self.assertEqual(data["meta"]["count"], len(expected))
        self.assertEqual(data["meta"]["storeMatches"], len(expected))
        self.assertEqual(data["meta"]["asOf"], source["meta"]["asOf"])
        self.assertNotIn("sourceUrl", data["meta"])
        excluded = [h for h in source["hotels"] if h["provider"] != "未绑定服务商"]
        for file in TARGET.rglob("*"):
            if not file.is_file():
                continue
            text = file.read_text()
            self.assertNotIn("../", text, str(file))
            self.assertNotIn("workbench_jinhe", text, str(file))
            for hotel in excluded:
                self.assertNotIn(hotel["id"], text, str(file))
                self.assertNotIn(hotel["provider"], text, str(file))

    def test_downloadable_csv_has_the_same_unbound_scope(self):
        data = json.loads((TARGET / "data/tianjin-hotels.json").read_text())
        csv_text = (TARGET / "data/tianjin-unbound-hotels.csv").read_text(encoding="utf-8-sig")
        rows = list(csv.DictReader(io.StringIO(csv_text)))
        self.assertEqual(len(rows), len(data["hotels"]))
        self.assertEqual({row["POI ID"] for row in rows}, {h["poiId"] for h in data["hotels"]})
        self.assertTrue(all(row["服务商"] == "未绑定服务商" for row in rows))


if __name__ == "__main__":
    unittest.main()
