"""Notification tests: privacy, marking read, unread counts."""

from __future__ import annotations


def _ticket_with_reply(client, register_user, category):
    customer = register_user("customer")
    agent = register_user("agent")
    res = client.post(
        "/api/v1/tickets",
        json={
            "subject": "Notification source",
            "description": "Please reply so I get notified.",
            "category_id": category["id"],
            "priority": "medium",
        },
        headers=customer.headers(),
    )
    assert res.status_code == 201, res.text
    ticket = res.json()
    res = client.post(
        f"/api/v1/tickets/{ticket['id']}/messages",
        json={"body": "Working on it now.", "visibility": "public"},
        headers=agent.headers(),
    )
    assert res.status_code == 201, res.text
    return customer, agent, ticket


def test_customer_gets_reply_notification(client, register_user, category):
    customer, _, _ = _ticket_with_reply(client, register_user, category)
    res = client.get("/api/v1/notifications", headers=customer.headers())
    assert res.status_code == 200
    body = res.json()
    assert body["total"] >= 1
    assert body["unread_count"] >= 1
    assert any("reply" in n["title"].lower() for n in body["items"])


def test_notifications_are_private_to_owner(client, register_user, category):
    customer, _, _ = _ticket_with_reply(client, register_user, category)
    stranger = register_user("customer")

    res = client.get("/api/v1/notifications", headers=stranger.headers())
    assert res.status_code == 200
    assert res.json()["total"] == 0


def test_mark_notification_read(client, register_user, category):
    customer, _, _ = _ticket_with_reply(client, register_user, category)
    res = client.get(
        "/api/v1/notifications", params={"unread_only": True}, headers=customer.headers()
    )
    items = res.json()["items"]
    assert items, "expected an unread notification"
    target = items[0]

    res = client.patch(
        f"/api/v1/notifications/{target['id']}/read", headers=customer.headers()
    )
    assert res.status_code == 200
    assert res.json()["is_read"] is True


def test_cannot_mark_other_users_notification_read(client, register_user, category):
    customer, _, _ = _ticket_with_reply(client, register_user, category)
    stranger = register_user("customer")

    res = client.get("/api/v1/notifications", headers=customer.headers())
    items = res.json()["items"]
    assert items

    res = client.patch(
        f"/api/v1/notifications/{items[0]['id']}/read", headers=stranger.headers()
    )
    assert res.status_code == 404  # ownership scoped: no leak


def test_mark_all_read(client, register_user, category):
    customer, _, _ = _ticket_with_reply(client, register_user, category)
    res = client.post("/api/v1/notifications/read-all", headers=customer.headers())
    assert res.status_code == 200

    res = client.get(
        "/api/v1/notifications", params={"unread_only": True}, headers=customer.headers()
    )
    assert res.json()["total"] == 0
    assert res.json()["unread_count"] == 0


def test_invalid_notification_id_is_404(client, register_user):
    account = register_user("customer")
    res = client.patch(
        "/api/v1/notifications/not-an-id/read", headers=account.headers()
    )
    assert res.status_code == 404


def test_notifications_require_auth(client):
    assert client.get("/api/v1/notifications").status_code == 401
