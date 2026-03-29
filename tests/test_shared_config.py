from __future__ import annotations

import unittest

from js_helpers import context_with_files, eval_json


class SharedConfigTests(unittest.TestCase):
    def setUp(self) -> None:
        self.context = context_with_files("shared/config.js")

    def test_storage_stats_count_products_and_observations(self) -> None:
        stats = eval_json(
            self.context,
            """
            RealDealShared.getStorageStats({
              rd_p_one: { history: [{ price: 10 }, { price: 8 }], lowestPrice: 8 },
              rd_p_two: { history: [{ price: 15 }], lowestPrice: 15 },
              rd_settings: { historyDays: 90 }
            })
            """,
        )
        self.assertEqual(stats["trackedProducts"], 2)
        self.assertEqual(stats["observationCount"], 3)

    def test_build_popup_product_key_is_stable(self) -> None:
        first = self.context.eval('RealDealShared.buildPopupProductKey("https://example.com/product?id=123&utm=test", "Widget")')
        second = self.context.eval('RealDealShared.buildPopupProductKey("https://example.com/product?id=123", "Widget")')
        self.assertEqual(first, second)


if __name__ == "__main__":
    unittest.main()
