from pathlib import Path
import unittest

from app.store import KnowledgeStore, cosine_similarity


class StoreTest(unittest.TestCase):
    def test_cosine_similarity(self):
        self.assertEqual(cosine_similarity([1, 0], [1, 0]), 1.0)
        self.assertEqual(cosine_similarity([1, 0], [0, 1]), 0.0)

    def test_store_search_returns_best_match(self):
        import tempfile

        with tempfile.TemporaryDirectory() as temp_dir:
            store = KnowledgeStore(Path(temp_dir) / "kb.sqlite")
            store.replace_document(
                "doc-a",
                "doc-a.md",
                [
                    ("alpha", [1.0, 0.0]),
                    ("beta", [0.0, 1.0]),
                ],
            )
            results = store.search([1.0, 0.0], top_k=1)
            self.assertEqual(len(results), 1)
            self.assertEqual(results[0].text, "alpha")


if __name__ == "__main__":
    unittest.main()
