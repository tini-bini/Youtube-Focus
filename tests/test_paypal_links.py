from __future__ import annotations

import unittest

from js_helpers import context_with_files, eval_json


class PayPalLinkTests(unittest.TestCase):
    def setUp(self) -> None:
        self.context = context_with_files("shared/config.js", "shared/paypal.js")

    def test_normalizes_supported_paypal_domains(self) -> None:
        result = self.context.eval('RealDealPayPal.normalizePayPalMeLink("www.paypal.com/paypalme/realdealteam")')
        self.assertEqual(result, "https://paypal.me/realdealteam")

    def test_builds_prefilled_amount_link(self) -> None:
        result = self.context.eval('RealDealPayPal.buildPayPalMeUrl("https://paypal.me/realdealteam", 15)')
        self.assertEqual(result, "https://paypal.me/realdealteam/15")

    def test_rejects_invalid_paypal_links(self) -> None:
        result = self.context.eval('RealDealPayPal.normalizePayPalMeLink("https://example.com/not-paypal")')
        self.assertIsNone(result)

    def test_empty_support_config_disables_buttons(self) -> None:
        links = eval_json(self.context, "RealDealPayPal.getSupportDestinations()")
        self.assertTrue(all(link["disabled"] for link in links))
        self.assertTrue(all(link["reason"] for link in links))


if __name__ == "__main__":
    unittest.main()
