import asyncio
import os
from app.core.config import settings
from app.services.verification_service import VerificationService

async def test_full_verify():
    class DummyDB:
        pass
    service = VerificationService(DummyDB())
    result = await service.verify(
        text="sam altman is planning to buy google",
        url=None,
        vertical=None,
        language="en"
    )
    print("Claims:", len(result["claims"]))
    print("Page score:", result["page_score"])

if __name__ == "__main__":
    asyncio.run(test_full_verify())
