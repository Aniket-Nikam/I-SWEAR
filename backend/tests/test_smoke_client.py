import asyncio
import httpx
import pytest
from scripts.smoke_casefile import QAClient


def test_qa_retries_only_interrupted_reads_without_masking_http_errors_or_posts():
    async def run():
        calls = []
        def respond(request):
            calls.append((request.method, request.url.path))
            if request.method == "POST" or len(calls) == 1:
                raise httpx.ReadError("synthetic connection reset")
            return httpx.Response(500 if request.url.path == "/broken" else 200, json={"ok":True})
        async with QAClient(base_url="https://test.invalid", transport=httpx.MockTransport(respond)) as client:
            assert (await client.get("/health")).status_code == 200
            assert len(calls) == 2
            with pytest.raises(httpx.HTTPStatusError):
                (await client.get("/broken")).raise_for_status()
            assert len(calls) == 3
            with pytest.raises(httpx.ReadError):
                await client.post("/mutation")
            assert len(calls) == 4
    asyncio.run(run())
