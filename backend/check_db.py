import asyncio
import json
from app.core.database import async_session_maker
from app.models.post import Post
from sqlalchemy import select
from sqlalchemy.orm import selectinload

async def check_db():
    async with async_session_maker() as session:
        result = await session.execute(
            select(Post)
            .options(
                selectinload(Post.author),
                selectinload(Post.verifications)
            )
            .order_by(Post.created_at.desc())
        )
        posts = result.scalars().unique().all()
        for p in posts:
            print(f"Post {p.id} by {p.author.username}: {p.content}")
            for v in p.verifications:
                print(f"  Verification {v.id}: score={v.overall_score}, status={v.status}, latest={v.is_latest}")

if __name__ == "__main__":
    asyncio.run(check_db())
