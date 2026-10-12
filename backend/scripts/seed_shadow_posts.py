"""
Create varied test posts and verify them, to feed the Jev shadow log.

Usage (from backend/):
    python scripts/seed_shadow_posts.py            # create posts, then verify each
    python scripts/seed_shadow_posts.py --no-verify
    python scripts/seed_shadow_posts.py --verify-only  # verify existing test posts that have no verification yet
    python scripts/seed_shadow_posts.py --cleanup  # delete the test user and its posts

Everything is attached to one dedicated account (username SHADOW_USER) so it is easy
to spot in the feed and to remove. Verifications are paced because laya-free allows
only ~5 requests per minute and each verification makes one shadow request.
"""
import argparse
import asyncio
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from sqlalchemy import delete, select  # noqa: E402

from app.core.database import async_session_maker  # noqa: E402
from app.models.article import Article  # noqa: E402
from app.models.post import Post  # noqa: E402
from app.models.verification import Verification  # noqa: E402
from app.models.user import User  # noqa: E402
from app.schemas import PostCreate, UserCreate  # noqa: E402
from app.services.auth_service import AuthService  # noqa: E402
from app.services.social_service import SocialService  # noqa: E402

SHADOW_USER = "jev_test"
SHADOW_EMAIL = "jev_test@verique.local"
PAUSE_SECONDS = 15

POSTS = [
    # --- pure facts: numbers, dates, names -----------------------------------
    "The Eiffel Tower in Paris is 330 metres tall and was completed in 1889.",
    "Mount Everest, at 8,849 metres above sea level, is the highest mountain on Earth.",
    "India's Chandrayaan-3 landed near the lunar south pole on 23 August 2023.",
    "The Reserve Bank of India was established on 1 April 1935.",
    "Water boils at 100 degrees Celsius at sea level atmospheric pressure.",
    # --- pure facts, several in one post -------------------------------------
    "Python was created by Guido van Rossum and first released in 1991. Its latest major version line is 3.x. "
    "The language is maintained by the Python Software Foundation.",
    "The Great Wall of China is over 21,000 kilometres long. It was built over many centuries, and parts of it "
    "date back to the 7th century BC. It is a UNESCO World Heritage Site.",
    "Apple was founded in 1976 by Steve Jobs, Steve Wozniak and Ronald Wayne. It is headquartered in Cupertino, "
    "California. It became the first US company to reach a $3 trillion market cap.",
    # --- false or dubious facts (should still be 'verifiable') ---------------
    "The Great Wall of China is visible from the Moon with the naked eye.",
    "Humans only use 10 percent of their brains.",
    "Mumbai is the capital city of India.",
    # --- pure opinions --------------------------------------------------------
    "I think this is the best phone anyone has ever made, hands down.",
    "Honestly, pineapple on pizza is disgusting and anyone who likes it has bad taste.",
    "Winter is far more beautiful than summer. Nothing beats a cold, quiet morning.",
    "Cricket is the most exciting sport in the world and it is not even close.",
    # --- predictions ---------------------------------------------------------
    "Bitcoin will reach $500,000 by the end of next year.",
    "In ten years, every car on the road will be fully self-driving.",
    "India will definitely win the next cricket World Cup.",
    # --- marketing fluff ------------------------------------------------------
    "Our revolutionary platform transforms the way teams collaborate and unlocks limitless potential.",
    "Experience the future of luxury living with our world-class, one-of-a-kind apartments.",
    # --- personal experience ---------------------------------------------------
    "I went to that new cafe downtown yesterday and the coffee made me feel amazing all afternoon.",
    "My grandmother always told me that the monsoon smells different in the village where she grew up.",
    # --- mixed fact and opinion in the same post ------------------------------
    "The iPhone 15 launched in September 2023 with a USB-C port, and honestly it is the most overrated phone ever.",
    "Tesla delivered about 1.8 million vehicles in 2023, which I think proves nobody can compete with Elon Musk.",
    "The Taj Mahal was completed around 1653 in Agra. It is obviously the most beautiful building humans have ever built.",
    "Nobody needs a smartwatch. Anyway, Apple sold over 30 million Apple Watches in 2022 according to analysts.",
    # --- fact + prediction -----------------------------------------------------
    "India's population passed 1.4 billion in 2023, and it will surely be the richest country on Earth by 2060.",
    "NASA's Artemis I mission flew around the Moon in November 2022, and humans will live on Mars by 2035.",
    # --- hedged / attributed statements --------------------------------------
    "According to the WHO, around 1.3 million people die each year in road traffic crashes.",
    "Some experts reportedly believe the economy could slow down, though no one really knows for sure.",
    # --- questions and rhetoric ------------------------------------------------
    "Is it just me, or has everything in this city gotten way too expensive lately?",
    "Why does nobody talk about how unfair the system is? Wake up people!",
    # --- numbers-heavy / statistical ------------------------------------------
    "India's GDP grew 8.2 percent in fiscal year 2023-24, while inflation averaged roughly 5.4 percent.",
    "The global smartphone market shipped about 1.17 billion units in 2023, a decline of around 3.2 percent.",
    # --- long, rambling, several claims of each kind --------------------------
    "So I finally read about the 2008 financial crisis. Lehman Brothers filed for bankruptcy on 15 September 2008, "
    "the largest bankruptcy filing in US history at the time. I think the bankers were absolutely greedy and "
    "deserved worse. The S&P 500 fell about 38 percent that year. Something like this will probably happen again.",
]


async def get_or_create_user(db) -> User:
    result = await db.execute(select(User).where(User.username == SHADOW_USER))
    user = result.scalar_one_or_none()
    if user is not None:
        return user
    await AuthService(db).register(
        UserCreate(
            email=SHADOW_EMAIL,
            username=SHADOW_USER,
            full_name="Jev Shadow Test",
            password="ShadowTest-12345!",
        )
    )
    result = await db.execute(select(User).where(User.username == SHADOW_USER))
    return result.scalar_one()


async def create_posts() -> list[int]:
    ids = []
    async with async_session_maker() as db:
        user = await get_or_create_user(db)
        service = SocialService(db)
        for content in POSTS:
            post = await service.create_post(user, PostCreate(content=content))
            ids.append(post.id)
        await db.commit()
    print(f"Created {len(ids)} posts as @{SHADOW_USER}: ids {ids[0]}..{ids[-1]}")
    return ids


async def verify_posts(ids: list[int]) -> None:
    for n, post_id in enumerate(ids, 1):
        # A fresh session per post: one failure must not poison the rest.
        try:
            async with async_session_maker() as db:
                result = await SocialService(db).verify_post(post_id)
                await db.commit()
            print(f"[{n}/{len(ids)}] post {post_id}: verified, score={result.score}", flush=True)
        except Exception as exc:  # keep going; the shadow log is what we want
            print(f"[{n}/{len(ids)}] post {post_id}: FAILED {type(exc).__name__}: {exc}", flush=True)
        if n < len(ids):
            await asyncio.sleep(PAUSE_SECONDS)


async def unverified_post_ids() -> list[int]:
    async with async_session_maker() as db:
        user = (await db.execute(select(User).where(User.username == SHADOW_USER))).scalar_one_or_none()
        if user is None:
            return []
        verified = select(Verification.post_id).where(Verification.post_id.is_not(None))
        result = await db.execute(
            select(Post.id)
            .where(Post.author_id == user.id, Post.id.not_in(verified))
            .order_by(Post.id)
        )
        return [row[0] for row in result.all()]


async def cleanup() -> None:
    async with async_session_maker() as db:
        result = await db.execute(select(User).where(User.username == SHADOW_USER))
        user = result.scalar_one_or_none()
        if user is None:
            print("No test user found, nothing to delete.")
            return
        post_ids = select(Post.id).where(Post.author_id == user.id)
        # articles.post_id is ON DELETE SET NULL, so remove them (and their claims) explicitly
        await db.execute(delete(Article).where(Article.post_id.in_(post_ids)))
        await db.execute(delete(Post).where(Post.author_id == user.id))
        await db.execute(delete(User).where(User.id == user.id))
        await db.commit()
        print(f"Deleted @{SHADOW_USER} and its posts.")


async def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--no-verify", action="store_true")
    parser.add_argument("--verify-only", action="store_true")
    parser.add_argument("--cleanup", action="store_true")
    args = parser.parse_args()

    if args.cleanup:
        await cleanup()
        return
    if args.verify_only:
        ids = await unverified_post_ids()
        print(f"{len(ids)} unverified test posts")
        await verify_posts(ids)
        return
    ids = await create_posts()
    if not args.no_verify:
        await verify_posts(ids)


if __name__ == "__main__":
    asyncio.run(main())
