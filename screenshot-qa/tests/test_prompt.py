import unittest
from pathlib import Path

from app.ocr import OCRLine, OCRResult
from app.qa import build_prompt


class PromptTest(unittest.TestCase):
    def test_prompt_includes_question_and_ocr_text(self):
        result = OCRResult(
            image_path=Path("sample.png"),
            text="Error: Cannot find module demo",
            lines=[OCRLine(text="Error: Cannot find module demo", confidence=0.99)],
        )
        prompt = build_prompt("怎么解决？", result)
        self.assertIn("怎么解决？", prompt)
        self.assertIn("Cannot find module", prompt)


if __name__ == "__main__":
    unittest.main()

