"""Ticket message tests: replies, internal-note privacy, permissions."""

from __future__ import annotations


def _setup_ticket(client, register_user, category):
    customer = register_user("customer")
    agent = register_user("agent")
    res = client.post(
        "/api/v1/tickets",
        json={
            "subject": "Help with my account",
            "description": "I cannot log in.",
            "category_id": category["id"],
            "priority": "medium",
        },
        headers=customer.headers(),
    )
    assert res.status_code == 201, res.text
    return customer, agent, res.json()


def test_customer_can_reply_to_own_ticket(client, register_user, category):
    customer, _, ticket = _setup_ticket(client, register_user, category)
    res = client.post(
        f"/api/v1/tickets/{ticket['id']}/messages",
        json={"body": "Any updates?", "visibility": "public"},
        headers=customer.headers(),
    )
    assert res.status_code == 201, res.text
    body = res.json()
    assert len(body["messages"]) == 1
    assert body["messages"][0]["body"] == "Any updates?"
    assert body["messages"][0]["visibility"] == "public"
    assert body["ticket"]["message_count"] == 1


def test_customer_cannot_reply_to_others_ticket(client, register_user, category):
    customer, _, ticket = _setup_ticket(client, register_user, category)
    stranger = register_user("customer")
    res = client.post(
        f"/api/v1/tickets/{ticket['id']}/messages",
        json={"body": "hi", "visibility": "public"},
        headers=stranger.headers(),
    )
    assert res.status_code == 404


def test_agent_can_reply(client, register_user, category):
    customer, agent, ticket = _setup_ticket(client, register_user, category)
    res = client.post(
        f"/api/v1/tickets/{ticket['id']}/messages",
        json={"body": "We are on it.", "visibility": "public"},
        headers=agent.headers(),
    )
    assert res.status_code == 201, res.text
    assert res.json()["messages"][-1]["author"]["id"] == agent.id


def test_customer_cannot_add_internal_note(client, register_user, category):
    customer, _, ticket = _setup_ticket(client, register_user, category)
    res = client.post(
        f"/api/v1/tickets/{ticket['id']}/messages",
        json={"body": "secret note", "visibility": "internal"},
        headers=customer.headers(),
    )
    assert res.status_code == 403


def test_agent_can_add_internal_note(client, register_user, category):
    _, agent, ticket = _setup_ticket(client, register_user, category)
    res = client.post(
        f"/api/v1/tickets/{ticket['id']}/messages",
        json={"body": "internal: customer forgot password", "visibility": "internal"},
        headers=agent.headers(),
    )
    assert res.status_code == 201, res.text
    assert res.json()["messages"][-1]["visibility"] == "internal"


def test_internal_notes_never_visible_to_customer(client, register_user, category):
    customer, agent, ticket = _setup_ticket(client, register_user, category)
    # Agent posts one public reply and one internal note.
    client.post(
        f"/api/v1/tickets/{ticket['id']}/messages",
        json={"body": "public answer", "visibility": "public"},
        headers=agent.headers(),
    )
    client.post(
        f"/api/v1/tickets/{ticket['id']}/messages",
        json={"body": "INTERNAL ONLY", "visibility": "internal"},
        headers=agent.headers(),
    )

    # Customer fetches the conversation: internal note must be absent.
    res = client.get(f"/api/v1/tickets/{ticket['id']}", headers=customer.headers())
    assert res.status_code == 200
    bodies = [m["body"] for m in res.json()["messages"]]
    assert "public answer" in bodies
    assert "INTERNAL ONLY" not in bodies
    assert all(m["visibility"] == "public" for m in res.json()["messages"])

    # Customer's own list view also never leaks the note.
    res = client.get(f"/api/v1/tickets", headers=customer.headers())
    assert "INTERNAL ONLY" not in res.text


def test_internal_notes_visible_to_agents_and_admins(
    client, register_user, category, admin_account
):
    customer, agent, ticket = _setup_ticket(client, register_user, category)
    client.post(
        f"/api/v1/tickets/{ticket['id']}/messages",
        json={"body": "INTERNAL ONLY", "visibility": "internal"},
        headers=agent.headers(),
    )

    res = client.get(f"/api/v1/tickets/{ticket['id']}", headers=agent.headers())
    assert any(m["visibility"] == "internal" for m in res.json()["messages"])

    res = client.get(f"/api/v1/tickets/{ticket['id']}", headers=admin_account.headers())
    assert any(m["body"] == "INTERNAL ONLY" for m in res.json()["messages"])


def test_messages_returned_in_chronological_order(client, register_user, category):
    customer, agent, ticket = _setup_ticket(client, register_user, category)
    for i, (account, body) in enumerate(
        [
            (customer, "msg one"),
            (agent, "msg two"),
            (customer, "msg three"),
        ]
    ):
        res = client.post(
            f"/api/v1/tickets/{ticket['id']}/messages",
            json={"body": body, "visibility": "public"},
            headers=account.headers(),
        )
        assert res.status_code == 201

    res = client.get(f"/api/v1/tickets/{ticket['id']}", headers=customer.headers())
    bodies = [m["body"] for m in res.json()["messages"]]
    assert bodies == ["msg one", "msg two", "msg three"]


def test_empty_message_rejected(client, register_user, category):
    customer, _, ticket = _setup_ticket(client, register_user, category)
    res = client.post(
        f"/api/v1/tickets/{ticket['id']}/messages",
        json={"body": "   ", "visibility": "public"},
        headers=customer.headers(),
    )
    assert res.status_code == 422
