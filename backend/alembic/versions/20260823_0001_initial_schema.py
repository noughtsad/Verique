"""Initial PostgreSQL schema.

Revision ID: 20260823_0001
Revises:
Create Date: 2026-08-23 00:00:00
"""
from alembic import op
import sqlalchemy as sa


revision = "20260823_0001"
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "domains",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("domain", sa.String(length=255), nullable=False),
        sa.Column("reputation_score", sa.Float(), nullable=True),
        sa.Column("total_claims_checked", sa.Integer(), nullable=True),
        sa.Column("claims_supported", sa.Integer(), nullable=True),
        sa.Column("claims_contradicted", sa.Integer(), nullable=True),
        sa.Column("claims_mixed", sa.Integer(), nullable=True),
        sa.Column("category", sa.String(length=50), nullable=True),
        sa.Column("is_official", sa.Integer(), nullable=True),
        sa.Column("first_seen_at", sa.DateTime(), nullable=True),
        sa.Column("last_updated_at", sa.DateTime(), nullable=True),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("domain"),
    )
    op.create_index(op.f("ix_domains_domain"), "domains", ["domain"], unique=True)
    op.create_index(op.f("ix_domains_id"), "domains", ["id"], unique=False)

    op.create_table(
        "users",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("email", sa.String(length=255), nullable=False),
        sa.Column("username", sa.String(length=50), nullable=False),
        sa.Column("full_name", sa.String(length=120), nullable=True),
        sa.Column("password_hash", sa.String(length=255), nullable=False),
        sa.Column("role", sa.String(length=20), nullable=False),
        sa.Column("is_active", sa.Boolean(), nullable=False),
        sa.Column("created_at", sa.DateTime(), nullable=True),
        sa.Column("updated_at", sa.DateTime(), nullable=True),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("email"),
        sa.UniqueConstraint("username"),
    )
    op.create_index(op.f("ix_users_email"), "users", ["email"], unique=True)
    op.create_index(op.f("ix_users_id"), "users", ["id"], unique=False)
    op.create_index(op.f("ix_users_username"), "users", ["username"], unique=True)

    op.create_table(
        "posts",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("author_id", sa.Integer(), nullable=False),
        sa.Column("content", sa.Text(), nullable=False),
        sa.Column("source_url", sa.String(length=2048), nullable=True),
        sa.Column("visibility", sa.String(length=20), nullable=False),
        sa.Column("created_at", sa.DateTime(), nullable=True),
        sa.Column("updated_at", sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(["author_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_posts_author_id"), "posts", ["author_id"], unique=False)
    op.create_index(op.f("ix_posts_id"), "posts", ["id"], unique=False)

    op.create_table(
        "articles",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("post_id", sa.Integer(), nullable=True),
        sa.Column("url", sa.String(length=2048), nullable=True),
        sa.Column("content_hash", sa.String(length=64), nullable=False),
        sa.Column("title", sa.String(length=500), nullable=True),
        sa.Column("text_content", sa.Text(), nullable=False),
        sa.Column("language", sa.String(length=10), nullable=True),
        sa.Column("vertical", sa.String(length=50), nullable=True),
        sa.Column("word_count", sa.Integer(), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=True),
        sa.Column("updated_at", sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(["post_id"], ["posts.id"], ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_articles_content_hash"), "articles", ["content_hash"], unique=False)
    op.create_index("ix_articles_content_hash_created", "articles", ["content_hash", "created_at"], unique=False)
    op.create_index(op.f("ix_articles_id"), "articles", ["id"], unique=False)
    op.create_index(op.f("ix_articles_post_id"), "articles", ["post_id"], unique=False)
    op.create_index(op.f("ix_articles_url"), "articles", ["url"], unique=False)

    op.create_table(
        "claims",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("article_id", sa.Integer(), nullable=False),
        sa.Column("text", sa.Text(), nullable=False),
        sa.Column("span_start", sa.Integer(), nullable=False),
        sa.Column("span_end", sa.Integer(), nullable=False),
        sa.Column("claim_type", sa.String(length=50), nullable=True),
        sa.Column("topic", sa.String(length=50), nullable=True),
        sa.Column("time_sensitivity", sa.String(length=20), nullable=True),
        sa.Column("is_verifiable", sa.Boolean(), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(["article_id"], ["articles.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_claims_id"), "claims", ["id"], unique=False)

    op.create_table(
        "sources",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("url", sa.String(length=2048), nullable=False),
        sa.Column("domain", sa.String(length=255), nullable=False),
        sa.Column("title", sa.String(length=500), nullable=True),
        sa.Column("snippet", sa.Text(), nullable=True),
        sa.Column("domain_reputation_score", sa.Float(), nullable=True),
        sa.Column("published_at", sa.DateTime(), nullable=True),
        sa.Column("first_seen_at", sa.DateTime(), nullable=True),
        sa.Column("last_used_at", sa.DateTime(), nullable=True),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("url"),
    )
    op.create_index(op.f("ix_sources_domain"), "sources", ["domain"], unique=False)
    op.create_index(op.f("ix_sources_id"), "sources", ["id"], unique=False)
    op.create_index(op.f("ix_sources_url"), "sources", ["url"], unique=True)

    op.create_table(
        "verifications",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("verification_uid", sa.String(length=50), nullable=False),
        sa.Column("article_id", sa.Integer(), nullable=True),
        sa.Column("post_id", sa.Integer(), nullable=True),
        sa.Column("version_number", sa.Integer(), nullable=False),
        sa.Column("is_latest", sa.Boolean(), nullable=False),
        sa.Column("status", sa.String(length=20), nullable=True),
        sa.Column("overall_score", sa.Float(), nullable=True),
        sa.Column("summary", sa.JSON(), nullable=True),
        sa.Column("processing_time_ms", sa.Integer(), nullable=True),
        sa.Column("models_used", sa.JSON(), nullable=True),
        sa.Column("sources_checked", sa.Integer(), nullable=True),
        sa.Column("content_hash", sa.String(length=64), nullable=True),
        sa.Column("verification_hash", sa.String(length=64), nullable=True),
        sa.Column("blockchain_tx", sa.String(length=100), nullable=True),
        sa.Column("challenge_count", sa.Integer(), nullable=False),
        sa.Column("review_status", sa.String(length=20), nullable=False),
        sa.Column("final_decision", sa.String(length=30), nullable=True),
        sa.Column("final_decision_note", sa.Text(), nullable=True),
        sa.Column("is_human_final", sa.Boolean(), nullable=False),
        sa.Column("created_at", sa.DateTime(), nullable=True),
        sa.Column("completed_at", sa.DateTime(), nullable=True),
        sa.Column("reviewed_at", sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(["article_id"], ["articles.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["post_id"], ["posts.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("verification_uid"),
    )
    op.create_index(op.f("ix_verifications_id"), "verifications", ["id"], unique=False)
    op.create_index(op.f("ix_verifications_post_id"), "verifications", ["post_id"], unique=False)
    op.create_index(op.f("ix_verifications_verification_uid"), "verifications", ["verification_uid"], unique=True)

    op.create_table(
        "challenges",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("verification_id", sa.Integer(), nullable=False),
        sa.Column("user_id", sa.Integer(), nullable=False),
        sa.Column("reason_code", sa.String(length=50), nullable=False),
        sa.Column("comment", sa.Text(), nullable=True),
        sa.Column("status", sa.String(length=20), nullable=False),
        sa.Column("created_at", sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["verification_id"], ["verifications.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("verification_id", "user_id", name="uq_challenges_verification_user"),
    )
    op.create_index(op.f("ix_challenges_id"), "challenges", ["id"], unique=False)
    op.create_index(op.f("ix_challenges_user_id"), "challenges", ["user_id"], unique=False)
    op.create_index(op.f("ix_challenges_verification_id"), "challenges", ["verification_id"], unique=False)

    op.create_table(
        "moderation_reviews",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("verification_id", sa.Integer(), nullable=False),
        sa.Column("moderator_id", sa.Integer(), nullable=True),
        sa.Column("status", sa.String(length=20), nullable=False),
        sa.Column("decision", sa.String(length=30), nullable=True),
        sa.Column("note", sa.Text(), nullable=True),
        sa.Column("override_score", sa.Integer(), nullable=True),
        sa.Column("override_summary", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=True),
        sa.Column("decided_at", sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(["moderator_id"], ["users.id"], ondelete="SET NULL"),
        sa.ForeignKeyConstraint(["verification_id"], ["verifications.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("verification_id"),
    )
    op.create_index(op.f("ix_moderation_reviews_id"), "moderation_reviews", ["id"], unique=False)
    op.create_index(op.f("ix_moderation_reviews_moderator_id"), "moderation_reviews", ["moderator_id"], unique=False)
    op.create_index(op.f("ix_moderation_reviews_verification_id"), "moderation_reviews", ["verification_id"], unique=True)

    op.create_table(
        "claim_verdicts",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("claim_id", sa.Integer(), nullable=False),
        sa.Column("verification_id", sa.Integer(), nullable=False),
        sa.Column("verdict", sa.String(length=30), nullable=False),
        sa.Column("confidence", sa.Float(), nullable=False),
        sa.Column("reasoning", sa.Text(), nullable=False),
        sa.Column("model_used", sa.String(length=50), nullable=False),
        sa.Column("created_at", sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(["claim_id"], ["claims.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["verification_id"], ["verifications.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_claim_verdicts_id"), "claim_verdicts", ["id"], unique=False)

    op.create_table(
        "verification_sources",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("claim_verdict_id", sa.Integer(), nullable=False),
        sa.Column("source_id", sa.Integer(), nullable=False),
        sa.Column("role", sa.String(length=20), nullable=False),
        sa.Column("relevance_score", sa.Float(), nullable=True),
        sa.Column("snippet_used", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(["claim_verdict_id"], ["claim_verdicts.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["source_id"], ["sources.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_verification_sources_id"), "verification_sources", ["id"], unique=False)


def downgrade() -> None:
    op.drop_index(op.f("ix_verification_sources_id"), table_name="verification_sources")
    op.drop_table("verification_sources")
    op.drop_index(op.f("ix_claim_verdicts_id"), table_name="claim_verdicts")
    op.drop_table("claim_verdicts")
    op.drop_index(op.f("ix_moderation_reviews_verification_id"), table_name="moderation_reviews")
    op.drop_index(op.f("ix_moderation_reviews_moderator_id"), table_name="moderation_reviews")
    op.drop_index(op.f("ix_moderation_reviews_id"), table_name="moderation_reviews")
    op.drop_table("moderation_reviews")
    op.drop_index(op.f("ix_challenges_verification_id"), table_name="challenges")
    op.drop_index(op.f("ix_challenges_user_id"), table_name="challenges")
    op.drop_index(op.f("ix_challenges_id"), table_name="challenges")
    op.drop_table("challenges")
    op.drop_index(op.f("ix_verifications_verification_uid"), table_name="verifications")
    op.drop_index(op.f("ix_verifications_post_id"), table_name="verifications")
    op.drop_index(op.f("ix_verifications_id"), table_name="verifications")
    op.drop_table("verifications")
    op.drop_index(op.f("ix_sources_url"), table_name="sources")
    op.drop_index(op.f("ix_sources_id"), table_name="sources")
    op.drop_index(op.f("ix_sources_domain"), table_name="sources")
    op.drop_table("sources")
    op.drop_index(op.f("ix_claims_id"), table_name="claims")
    op.drop_table("claims")
    op.drop_index(op.f("ix_articles_url"), table_name="articles")
    op.drop_index(op.f("ix_articles_post_id"), table_name="articles")
    op.drop_index(op.f("ix_articles_id"), table_name="articles")
    op.drop_index("ix_articles_content_hash_created", table_name="articles")
    op.drop_index(op.f("ix_articles_content_hash"), table_name="articles")
    op.drop_table("articles")
    op.drop_index(op.f("ix_posts_id"), table_name="posts")
    op.drop_index(op.f("ix_posts_author_id"), table_name="posts")
    op.drop_table("posts")
    op.drop_index(op.f("ix_users_username"), table_name="users")
    op.drop_index(op.f("ix_users_id"), table_name="users")
    op.drop_index(op.f("ix_users_email"), table_name="users")
    op.drop_table("users")
    op.drop_index(op.f("ix_domains_domain"), table_name="domains")
    op.drop_index(op.f("ix_domains_id"), table_name="domains")
    op.drop_table("domains")
