from __future__ import annotations

import unittest
from pathlib import Path

from js_helpers import context_with_files, eval_json


SETUP = """
var RealDeal = {
  Utils: {
    clamp: function(value, min, max) { return Math.min(max, Math.max(min, value)); },
    formatPrice: function(amount, currency) { return currency + " " + Number(amount).toFixed(2); }
  }
};
"""


class TrustScoreTests(unittest.TestCase):
    def setUp(self) -> None:
        self.context = context_with_files()
        self.context.eval(SETUP)
        self.context.eval((Path(__file__).resolve().parents[1] / "content/analyzers/trust-score.js").read_text(encoding="utf-8"))

    def test_green_score_for_real_discount(self) -> None:
        result = eval_json(
            self.context,
            """
            RealDeal.TrustScore.calculate(
              { currentPrice: 80, highestPrice: 100, salePercent: 20, isOnSale: true, currency: "USD" },
              { lowestPrice: 80, highestPrice: 100, history: [
                { timestamp: 1, price: 100 },
                { timestamp: 86400000 * 20, price: 80 }
              ] },
              []
            )
            """,
        )
        self.assertEqual(result["category"], "green")
        self.assertGreaterEqual(result["score"], 80)

    def test_red_score_for_multiple_high_risk_signals(self) -> None:
        result = eval_json(
            self.context,
            """
            RealDeal.TrustScore.calculate(
              { currentPrice: 95, salePercent: 50, isOnSale: true, currency: "USD" },
              { lowestPrice: 90, highestPrice: 100, history: [
                { timestamp: 1, price: 100 },
                { timestamp: 86400000 * 30, price: 95 }
              ] },
              [
                { type: "rollback", label: "Pre-Sale Price Spike", severity: "high" },
                { type: "price_anchor", label: "Inflated Original Price", severity: "high" }
              ]
            )
            """,
        )
        self.assertEqual(result["category"], "red")
        self.assertLess(result["score"], 40)


if __name__ == "__main__":
    unittest.main()
