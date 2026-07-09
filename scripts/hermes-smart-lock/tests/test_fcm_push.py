import os
import sys
import unittest

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from fcm_push import COMMON_GAME_PACKAGES, resolve_block_packages


class ResolveBlockPackagesTest(unittest.TestCase):
    USAGE = [
        {"packageName": "com.sec.android.app.sbrowser", "label": "Samsung Internet", "totalTimeMs": 1000},
        {"packageName": "com.some.unknown.game", "label": "Cool Game", "totalTimeMs": 1000},
        {"packageName": "com.whatsapp", "label": "WhatsApp", "totalTimeMs": 1000},
    ]

    def test_browser_includes_curated_and_usage(self):
        packages = resolve_block_packages(["browser"], self.USAGE)
        self.assertIn("com.android.chrome", packages)
        self.assertIn("com.sec.android.app.sbrowser", packages)
        self.assertNotIn("com.whatsapp", packages)

    def test_games_includes_curated_and_usage(self):
        packages = resolve_block_packages(["games"], self.USAGE)
        self.assertTrue(set(COMMON_GAME_PACKAGES).issubset(set(packages)))
        self.assertIn("com.some.unknown.game", packages)

    def test_both_categories_is_union(self):
        browser = set(resolve_block_packages(["browser"], self.USAGE))
        games = set(resolve_block_packages(["games"], self.USAGE))
        both = set(resolve_block_packages(["browser", "games"], self.USAGE))
        self.assertEqual(both, browser | games)

    def test_empty_categories_yields_nothing(self):
        self.assertEqual(resolve_block_packages([], self.USAGE), [])

    def test_result_is_sorted_and_unique(self):
        packages = resolve_block_packages(["browser", "games"], self.USAGE)
        self.assertEqual(packages, sorted(set(packages)))


if __name__ == "__main__":
    unittest.main()
