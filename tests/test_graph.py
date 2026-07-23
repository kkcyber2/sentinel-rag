import os
import unittest
from unittest.mock import patch, MagicMock
from app.graph import parse_verifier_json, run_sentinel_workflow, get_llm, invoke_llm
from app.vectorstore import vector_store

class TestGraphWorkflow(unittest.TestCase):
    def setUp(self):
        vector_store.clear()

    def test_verifier_json_parser_clean(self):
        clean_json = '{"approved": true, "issues": [], "reasoning": "Valid context"}'
        result = parse_verifier_json(clean_json)
        self.assertTrue(result["approved"])
        self.assertEqual(len(result["issues"]), 0)

    def test_verifier_json_parser_malformed_prose(self):
        prose_text = "The draft answer is verified: true and looks fully supported."
        result = parse_verifier_json(prose_text)
        self.assertTrue(result["approved"])

    @patch('app.graph.invoke_llm')
    @patch.object(vector_store, 'search')
    def test_grounding_test(self, mock_search, mock_invoke):
        mock_search.return_value = [
            {"id": "chunk_1", "text": "Hardware security keys such as YubiKey are mandatory for MFA.", "metadata": {"source": "policy.txt", "page": 1}}
        ]
        mock_invoke.side_effect = [
            "Hardware security keys such as YubiKey are required for MFA.",  # Research draft
            '{"approved": true, "issues": [], "reasoning": "Directly supported"}' # Verifier approval
        ]

        res = run_sentinel_workflow("What hardware keys are required for MFA?")
        self.assertTrue(res["verified"])
        self.assertIn("YubiKey", res["answer"])
        self.assertGreater(len(res["sources"]), 0)

    @patch('app.graph.invoke_llm')
    @patch.object(vector_store, 'search')
    def test_hallucination_trap_and_out_of_scope(self, mock_search, mock_invoke):
        mock_search.return_value = [
            {"id": "chunk_1", "text": "This document covers password complexity rules.", "metadata": {"source": "policy.txt", "page": 1}}
        ]
        mock_invoke.side_effect = [
            "The capital of France is Paris.", # Research draft hallucination
            '{"approved": false, "issues": ["Capital of France is not in the document."], "reasoning": "Out of scope"}' # Verifier rejection
        ]

        res = run_sentinel_workflow("What is the capital of France?")
        self.assertFalse(res["verified"])
        self.assertIn("issues", res)

    @patch('app.graph.invoke_llm')
    @patch.object(vector_store, 'search')
    def test_retry_loop_tracking(self, mock_search, mock_invoke):
        mock_search.return_value = [
            {"id": "chunk_1", "text": "API keys must be stored in environment variables.", "metadata": {"source": "policy.txt", "page": 1}}
        ]
        mock_invoke.side_effect = [
            "API keys should be hardcoded in code.", # Draft 1
            '{"approved": false, "issues": ["API keys should not be hardcoded."], "reasoning": "Incorrect"}', # Verifier 1 rejects
            "API keys must be stored in environment variables.", # Revised Draft
            '{"approved": true, "issues": [], "reasoning": "Corrected"}' # Verifier 2 approves
        ]

        res = run_sentinel_workflow("Explain API key storage.")
        self.assertTrue(res["verified"])
        self.assertIn("audit_trail", res)

        # Check that revise node was executed in the audit trail
        steps = [entry["step"] for entry in res["audit_trail"]]
        self.assertIn("revise", steps)

    @patch('app.graph.get_llm')
    def test_ollama_down_fails_loudly(self, mock_get_llm):
        mock_get_llm.side_effect = RuntimeError("LLM Service Unavailable: Ollama model is unreachable")
        
        with self.assertRaises(RuntimeError) as ctx:
            invoke_llm("system prompt", "user prompt")
        self.assertIn("Unavailable", str(ctx.exception))

if __name__ == "__main__":
    unittest.main()
