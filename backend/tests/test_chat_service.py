"""
Unit tests for ChatService.
"""
import pytest

from app.services.chat_service import ChatService


async def test_get_or_create_conversation_is_idempotent(db_session, user_a, user_b):
    service = ChatService(db_session)

    first = await service.get_or_create_conversation(user_a, user_b.username)
    second = await service.get_or_create_conversation(user_b, user_a.username)

    assert first.id == second.id
    assert first.other_user.username == user_b.username
    assert second.other_user.username == user_a.username


async def test_cannot_message_self(db_session, user_a):
    service = ChatService(db_session)
    with pytest.raises(ValueError):
        await service.get_or_create_conversation(user_a, user_a.username)


async def test_message_to_unknown_user_raises(db_session, user_a):
    service = ChatService(db_session)
    with pytest.raises(ValueError):
        await service.get_or_create_conversation(user_a, "nobody")


async def test_send_message_updates_last_message_at(db_session, user_a, user_b):
    service = ChatService(db_session)
    conversation = await service.get_or_create_conversation(user_a, user_b.username)
    assert conversation.last_message_at is None

    message = await service.send_message(user_a, conversation.id, "hello there")
    assert message.content == "hello there"
    assert message.sender.username == user_a.username

    refreshed = await service.get_or_create_conversation(user_a, user_b.username)
    assert refreshed.last_message_at == message.created_at
    assert refreshed.last_message.id == message.id


async def test_list_messages_pagination_and_order(db_session, user_a, user_b):
    service = ChatService(db_session)
    conversation = await service.get_or_create_conversation(user_a, user_b.username)

    sent = []
    for i in range(5):
        sent.append(await service.send_message(user_a, conversation.id, f"message {i}"))

    all_messages = await service.list_messages(user_a, conversation.id, limit=50)
    assert [m.content for m in all_messages] == [f"message {i}" for i in range(5)]

    # Paginate backwards using the `before_id` cursor of the 4th message.
    page = await service.list_messages(
        user_a, conversation.id, before_id=sent[3].id, limit=50
    )
    assert [m.content for m in page] == [f"message {i}" for i in range(3)]


async def test_unread_count_math(db_session, user_a, user_b):
    service = ChatService(db_session)
    conversation = await service.get_or_create_conversation(user_a, user_b.username)

    await service.send_message(user_a, conversation.id, "first")
    await service.send_message(user_a, conversation.id, "second")

    # The sender never sees their own messages as unread.
    from_a_side = await service.list_conversations(user_a)
    assert from_a_side[0].unread_count == 0

    from_b_side = await service.list_conversations(user_b)
    assert from_b_side[0].unread_count == 2

    await service.mark_conversation_read(user_b, conversation.id)

    from_b_side_after = await service.list_conversations(user_b)
    assert from_b_side_after[0].unread_count == 0


async def test_non_participant_cannot_access_conversation(db_session, user_a, user_b, user_c):
    service = ChatService(db_session)
    conversation = await service.get_or_create_conversation(user_a, user_b.username)

    with pytest.raises(ValueError):
        await service.list_messages(user_c, conversation.id)

    with pytest.raises(ValueError):
        await service.send_message(user_c, conversation.id, "sneaky")

    with pytest.raises(ValueError):
        await service.mark_conversation_read(user_c, conversation.id)
