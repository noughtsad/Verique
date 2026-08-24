import asyncio
from app.core.config import settings
from app.agents.pipeline import VerificationPipeline

async def test_verification():
    pipeline = VerificationPipeline()
    result = await pipeline.run(
        text="sam altman is planning to buy google",
        url=None,
        vertical="general",
        language="en"
    )
    print("Extracted claims:", result.get("claims"))
    print("Errors:", result.get("errors"))
    print("Page score:", result.get("page_score", "not calculated in pipeline.run"))

if __name__ == "__main__":
    asyncio.run(test_verification())
