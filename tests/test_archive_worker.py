"""Offline, synthetic regression for the read-only archive worker."""

import json
import os
from pathlib import Path
from tempfile import TemporaryDirectory
import unittest
from unittest.mock import AsyncMock, Mock, patch

from fastapi.testclient import TestClient

from back_end import vps_api


class TestArchiveWorker(unittest.TestCase):
    def test_retired_routes(self):
        client = TestClient(vps_api.app)
        self.assertEqual(client.get("/health").json()["status"], "ok")
        paths = ("/process-url", "/extract", "/upload-to-speckle")
        for path in paths:
            response = client.post(path, content=b"synthetic input")
            self.assertEqual(response.status_code, 410, path)
            self.assertEqual(response.json()["libraryUrl"], "/models")
            self.assertEqual(response.json()["workbenchUrl"], "/workbench")
        for path in ("/test-speckle", "/import-status/old"):
            self.assertEqual(client.get(path).status_code, 410, path)

    def test_archive_summary(self):
        with TemporaryDirectory() as root, patch.object(vps_api, "DATA_DIR", Path(root)), patch.dict(
            os.environ, {"VPS_SECRET_TOKEN": "local-fixture"}
        ):
            path = Path(root) / "old_1_full.json"
            sample = {"file": "合成.ifc", "summary": {"total_objects": 2}, "categories": {"walls": 2}}
            path.write_text(json.dumps(sample), encoding="utf-8")
            client = TestClient(vps_api.app)
            url = "/project/old_1/summary"
            self.assertEqual(client.get(url).status_code, 401)
            headers = {"X-VPS-Token": "local-fixture"}
            response = client.get(url, headers=headers)
            self.assertEqual(response.status_code, 200)
            self.assertEqual(response.json()["total_elements"], 2)
            self.assertEqual(response.json()["element_statistics"], {"walls": 2})
            self.assertEqual(response.headers["cache-control"], "private, no-store")
            self.assertEqual(client.get("/project/unknown/summary", headers=headers).status_code, 404)
            response = client.post("/compliance-check", headers=headers, json={"model_id": "old_1", "file_name": "QA.ifc"})
            self.assertEqual(response.status_code, 200)
            self.assertEqual(response.json()["issues"][0]["category"], "NAMING")
            self.assertEqual(client.post("/compliance-check", headers=headers, json={"model_id": "unknown"}).status_code, 404)
            with patch.dict(os.environ, {"GEMINI_API_KEY": "fixture"}), patch.object(vps_api.httpx, "AsyncClient") as cls:
                upstream = AsyncMock()
                cls.return_value.__aenter__.return_value = upstream
                upstream.post.return_value = Mock(json=lambda: {"candidates": [{"content": {"parts": [{"text": "2"}]}}]})
                answer = client.post("/audit", headers=headers, json={"project_id": "old_1", "question": "多少构件？"})
                self.assertEqual(answer.json(), {"answer": "2"})
                self.assertIn("合成.ifc", str(upstream.post.call_args.kwargs["json"]))
            self.assertEqual(json.loads(path.read_text(encoding="utf-8")), sample)


if __name__ == "__main__":
    unittest.main()
