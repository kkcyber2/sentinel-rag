import unittest
import os
from unittest.mock import patch
from app.vectorstore import vector_store
from app.graph import run_sentinel_workflow

class TestAPIEndpoints(unittest.TestCase):
    def setUp(self):
        vector_store.clear()

    def test_health_check_simulation(self):
        status_data = {
            "status": "ok",
            "vector_store": {"chunk_count": vector_store.count(), "engine": "ChromaDB"}
        }
        self.assertEqual(status_data["status"], "ok")
        self.assertEqual(status_data["vector_store"]["engine"], "ChromaDB")

    def test_empty_state_ask_fails_gracefully(self):
        result = run_sentinel_workflow("What is the policy?")
        self.assertFalse(result["verified"])
        self.assertIn("No document context", result["issues"][0])

    @patch('app.graph.invoke_llm')
    @patch.object(vector_store, 'search')
    def test_upload_and_ask_flow(self, mock_search, mock_invoke):
        mock_search.return_value = [
            {"id": "chunk_1", "text": "Passwords must be 16+ characters long.", "metadata": {"source": "cybersecurity_policy.txt", "page": 1}}
        ]
        mock_invoke.side_effect = [
            "Passwords must be at least 16 characters long.",
            '{"approved": true, "issues": [], "reasoning": "Directly supported"}'
        ]

        res = run_sentinel_workflow("What is the password requirement?")
        self.assertIn("answer", res)
        self.assertTrue(res["verified"])
        self.assertIn("16 characters", res["answer"])

if __name__ == "__main__":
    unittest.main()
