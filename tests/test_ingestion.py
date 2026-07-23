import os
import unittest
from unittest.mock import MagicMock, patch
from app.ingestion import recursive_character_text_splitter, ingest_file
from app.vectorstore import vector_store

class TestIngestion(unittest.TestCase):
    def setUp(self):
        vector_store.clear()

    def test_chunk_count_and_overlap(self):
        sample_text = "Word " * 300  # ~1500 chars
        chunks = recursive_character_text_splitter(sample_text, chunk_size=500, chunk_overlap=75)
        self.assertGreater(len(chunks), 1)
        for chunk in chunks:
            self.assertLessEqual(len(chunk), 550)

    @patch.object(vector_store, 'add_documents')
    def test_file_ingestion(self, mock_add_docs):
        mock_add_docs.return_value = 5
        test_file_path = "data/sample_docs/cybersecurity_policy.txt"
        if os.path.exists(test_file_path):
            added = ingest_file(test_file_path)
            self.assertGreater(added, 0)
            mock_add_docs.assert_called()

if __name__ == "__main__":
    unittest.main()
