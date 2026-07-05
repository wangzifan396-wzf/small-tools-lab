import unittest

from app.chunking import chunk_text, normalize_text


class ChunkingTest(unittest.TestCase):
    def test_normalize_text_collapses_blank_lines(self):
        self.assertEqual(normalize_text("a\r\n\r\n\r\nb"), "a\n\nb")

    def test_chunk_text_splits_long_text(self):
        chunks = chunk_text("a" * 2500, max_chars=1000, overlap=100)
        self.assertEqual(len(chunks), 3)
        self.assertTrue(all(len(chunk) <= 1000 for chunk in chunks))

    def test_chunk_text_adds_overlap_to_long_paragraph(self):
        text = "abcdefghijklmnopqrstuvwxyz" * 100
        chunks = chunk_text(text, max_chars=500, overlap=20)
        self.assertGreaterEqual(len(chunks), 2)
        self.assertTrue(chunks[1].startswith(chunks[0][-20:]))


if __name__ == "__main__":
    unittest.main()
