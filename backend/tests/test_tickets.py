"""Ticket lifecycle tests: create, list, detail, update, transitions."""

from __future__ import annotations


def _create_ticket(client, account, category_id, **overrides):
    payload = {
        "subject": "My printer is on fire",
        "description": "It started when I pressed the big red button.",
        "category_id": category_id,
        "priority": "medium",
    }
    payload.update(overrides)
    res = client.post("/api/v1/tickets", json=payload, headers=account.headers())
    return res


def test_create_ticket_requires_auth(client, category):
    res = client.post(
        "/api/v1/tickets",
        json={
            "subject": "anon",
            "description": "anon",
            "category_id": category["id"],
            "priority": "low",
        },
    )
    assert res.status_code == 401


def test_create_ticket_success(client, register_user, category):
    account = register_user("customer")
    res = _create_ticket(client, account, category["id"])
    assert res.status_code == 201, res.text
    body = res.json()
    assert body["subject"] == "My printer is on fire"
    assert body["status"] == "open"
    assert body["priority"] == "medium"
    assert body["ticket_number"] >= 1
    assert body["requester"]["id"] == account.id
    assert body["assignee"] is None
    assert body["category"]["id"] == category["id"]


def test_create_ticket_rejects_unknown_category(client, register_user):
    account = register_user("customer")
    res = _create_ticket(client, account, "000000000000000000000000")
    assert res.status_code == 404


def test_create_ticket_rejects_malformed_category_id(client, register_user):
    account = register_user("customer")
    res = _create_ticket(client, account, "not-an-objectid")
    assert res.status_code == 422


def test_create_ticket_rejects_inactive_category(client, admin_account, register_user):
    account = register_user("customer")
    res = client.post(
        "/api/v1/categories",
        json={"name": "Retired cat", "is_active": False},
        headers=admin_account.headers(),
    )
    assert res.status_code == 201
    inactive_id = res.json()["id"]
    res = _create_ticket(client, account, inactive_id)
    assert res.status_code == 400


def test_create_ticket_rejects_missing_fields(client, register_user, category):
    account = register_user("customer")
    res = client.post(
        "/api/v1/tickets",
        json={"subject": "Only subject"},
        headers=account.headers(),
    )
    assert res.status_code == 422


def test_customer_ticket_list_only_shows_own(client, register_user, category):
    alice = register_user("customer")
    bob = register_user("customer")
    assert _create_ticket(client, alice, category["id"]).status_code == 201
    assert _create_ticket(client, bob, category["id"], subject="Bob's ticket").status_code == 201

    res = client.get("/api/v1/tickets", headers=alice.headers())
    assert res.status_code == 200
    items = res.json()["items"]
    assert items, "expected at least one ticket for alice"
    assert all(t["requester"]["id"] == alice.id for t in items)
    assert all(t["subject"] != "Bob's ticket" for t in items)


def test_customer_cannot_read_other_customers_ticket(client, register_user, category):
    alice = register_user("customer")
    bob = register_user("customer")
    created = _create_ticket(client, bob, category["id"]).json()

    res = client.get(f"/api/v1/tickets/{created['id']}", headers=alice.headers())
    assert res.status_code == 404  # not 403: existence is not leaked


def test_ticket_detail_includes_conversation(client, register_user, category):
    account = register_user("customer")
    created = _create_ticket(client, account, category["id"]).json()
    res = client.get(f"/api/v1/tickets/{created['id']}", headers=account.headers())
    assert res.status_code == 200
    body = res.json()
    assert body["ticket"]["id"] == created["id"]
    assert body["messages"] == []


def test_ticket_not_found_and_invalid_id(client, register_user):
    account = register_user("customer")
    assert (
        client.get("/api/v1/tickets/000000000000000000000000", headers=account.headers()).status_code
        == 404
    )
    assert client.get("/api/v1/tickets/garbage", headers=account.headers()).status_code == 404


def test_customer_can_edit_own_ticket_fields(client, register_user, category):
    account = register_user("customer")
    created = _create_ticket(client, account, category["id"]).json()
    res = client.patch(
        f"/api/v1/tickets/{created['id']}",
        json={"subject": "Updated subject", "priority": "high"},
        headers=account.headers(),
    )
    assert res.status_code == 200, res.text
    body = res.json()
    assert body["subject"] == "Updated subject"
    assert body["priority"] == "high"


def test_customer_cannot_change_status(client, register_user, category):
    account = register_user("customer")
    created = _create_ticket(client, account, category["id"]).json()
    res = client.patch(
        f"/api/v1/tickets/{created['id']}",
        json={"status": "resolved"},
        headers=account.headers(),
    )
    assert res.status_code == 403


def test_customer_cannot_edit_others_ticket(client, register_user, category):
    alice = register_user("customer")
    bob = register_user("customer")
    created = _create_ticket(client, bob, category["id"]).json()
    res = client.patch(
        f"/api/v1/tickets/{created['id']}",
        json={"subject": "Hijacked"},
        headers=alice.headers(),
    )
    assert res.status_code == 404


def test_agent_can_change_status(client, register_user, category):
    customer = register_user("customer")
    agent = register_user("agent")
    created = _create_ticket(client, customer, category["id"]).json()
    res = client.patch(
        f"/api/v1/tickets/{created['id']}",
        json={"status": "in_progress"},
        headers=agent.headers(),
    )
    assert res.status_code == 200, res.text
    assert res.json()["status"] == "in_progress"


def test_invalid_status_transition_rejected(client, register_user, category):
    customer = register_user("customer")
    agent = register_user("agent")
    created = _create_ticket(client, customer, category["id"]).json()

    # close first (open -> closed is allowed)
    res = client.patch(
        f"/api/v1/tickets/{created['id']}",
        json={"status": "closed"},
        headers=agent.headers(),
    )
    assert res.status_code == 200
    # closed -> pending is not allowed (only reopen -> open)
    res = client.patch(
        f"/api/v1/tickets/{created['id']}",
        json={"status": "pending"},
        headers=agent.headers(),
    )
    assert res.status_code == 400


def test_customer_cannot_edit_resolved_or_closed_ticket(client, register_user, category):
    customer = register_user("customer")
    agent = register_user("agent")
    created = _create_ticket(client, customer, category["id"]).json()
    client.patch(
        f"/api/v1/tickets/{created['id']}",
        json={"status": "resolved"},
        headers=agent.headers(),
    )
    res = client.patch(
        f"/api/v1/tickets/{created['id']}",
        json={"subject": "late edit"},
        headers=customer.headers(),
    )
    assert res.status_code == 400


def test_list_filters_status_priority_search(client, register_user, category):
    account = register_user("customer")
    _create_ticket(client, account, category["id"], subject="Network outage", priority="urgent")
    _create_ticket(client, account, category["id"], subject="Password reset", priority="low")

    res = client.get(
        "/api/v1/tickets",
        params={"priority": "urgent"},
        headers=account.headers(),
    )
    assert res.status_code == 200
    items = res.json()["items"]
    assert items and all(t["priority"] == "urgent" for t in items)

    res = client.get(
        "/api/v1/tickets", params={"search": "Network outage"}, headers=account.headers()
    )
    items = res.json()["items"]
    assert len(items) == 1
    assert items[0]["subject"] == "Network outage"


def test_list_pagination_envelope(client, register_user, category):
    account = register_user("customer")
    for i in range(3):
        _create_ticket(client, account, category["id"], subject=f"Ticket {i}")

    res = client.get(
        "/api/v1/tickets", params={"page": 1, "page_size": 2}, headers=account.headers()
    )
    body = res.json()
    assert body["page"] == 1
    assert body["page_size"] == 2
    assert len(body["items"]) == 2
    assert body["total"] >= 3
    assert body["pages"] >= 2


def test_list_rejects_bad_sort_field(client, register_user):
    account = register_user("customer")
    res = client.get(
        "/api/v1/tickets", params={"sort_by": "password_hash"}, headers=account.headers()
    )
    assert res.status_code == 422


def test_assignment_by_customer_forbidden(client, register_user, category):
    account = register_user("customer")
    agent = register_user("agent")
    created = _create_ticket(client, account, category["id"]).json()
    res = client.post(
        f"/api/v1/tickets/{created['id']}/assign",
        json={"assignee_id": agent.id},
        headers=account.headers(),
    )
    assert res.status_code == 403


def test_agent_self_assign_and_unassign(client, register_user, category):
    customer = register_user("customer")
    agent = register_user("agent")
    created = _create_ticket(client, customer, category["id"]).json()

    res = client.post(
        f"/api/v1/tickets/{created['id']}/assign",
        json={"assignee_id": agent.id},
        headers=agent.headers(),
    )
    assert res.status_code == 200, res.text
    assert res.json()["assignee"]["id"] == agent.id

    res = client.post(
        f"/api/v1/tickets/{created['id']}/assign",
        json={"assignee_id": None},
        headers=agent.headers(),
    )
    assert res.status_code == 200
    assert res.json()["assignee"] is None


def test_assign_to_customer_role_rejected(client, register_user, category):
    customer = register_user("customer")
    other_customer = register_user("customer")
    agent = register_user("agent")
    created = _create_ticket(client, customer, category["id"]).json()
    res = client.post(
        f"/api/v1/tickets/{created['id']}/assign",
        json={"assignee_id": other_customer.id},
        headers=agent.headers(),
    )
    assert res.status_code == 400


def test_agent_sees_unassigned_queue_and_assigned(client, register_user, category):
    customer = register_user("customer")
    agent = register_user("agent")
    other_agent = register_user("agent")

    mine = _create_ticket(client, customer, category["id"], subject="For agent").json()
    # Assign a second ticket to a different agent — should be invisible.
    other = _create_ticket(client, customer, category["id"], subject="For other agent").json()
    client.post(
        f"/api/v1/tickets/{other['id']}/assign",
        json={"assignee_id": other_agent.id},
        headers=other_agent.headers(),
    )

    res = client.get("/api/v1/tickets", headers=agent.headers())
    assert res.status_code == 200
    ids = [t["id"] for t in res.json()["items"]]
    assert mine["id"] in ids  # unassigned queue item
    assert other["id"] not in ids  # assigned to someone else


def test_admin_sees_all_tickets(client, register_user, category, admin_account):
    customer = register_user("customer")
    _create_ticket(client, customer, category["id"])
    res = client.get("/api/v1/tickets", headers=admin_account.headers())
    assert res.status_code == 200
    assert res.json()["total"] >= 1


# --------------------------- "who solved it" -------------------------------


def test_resolving_records_the_solver(client, register_user, category):
    customer = register_user("customer")
    agent = register_user("agent")
    created = _create_ticket(client, customer, category["id"]).json()
    assert created["resolved_by"] is None
    assert created["resolved_at"] is None

    res = client.patch(
        f"/api/v1/tickets/{created['id']}",
        json={"status": "resolved"},
        headers=agent.headers(),
    )
    assert res.status_code == 200, res.text
    body = res.json()
    assert body["resolved_by"]["id"] == agent.id
    assert body["resolved_by"]["role"] == "agent"
    assert body["resolved_at"] is not None

    # The requester (customer) also sees who solved it in their list.
    res = client.get("/api/v1/tickets", headers=customer.headers())
    listed = next(t for t in res.json()["items"] if t["id"] == created["id"])
    assert listed["resolved_by"]["id"] == agent.id
    assert listed["resolved_at"] is not None


def test_reopen_clears_the_solver(client, register_user, category):
    customer = register_user("customer")
    agent = register_user("agent")
    created = _create_ticket(client, customer, category["id"]).json()

    client.patch(
        f"/api/v1/tickets/{created['id']}",
        json={"status": "resolved"},
        headers=agent.headers(),
    )
    res = client.patch(
        f"/api/v1/tickets/{created['id']}",
        json={"status": "open"},
        headers=agent.headers(),
    )
    assert res.status_code == 200, res.text
    assert res.json()["resolved_by"] is None
    assert res.json()["resolved_at"] is None


def test_closing_after_resolving_keeps_original_solver(client, register_user, category, admin_account):
    customer = register_user("customer")
    agent = register_user("agent")
    created = _create_ticket(client, customer, category["id"]).json()

    client.patch(
        f"/api/v1/tickets/{created['id']}",
        json={"status": "resolved"},
        headers=agent.headers(),
    )
    res = client.patch(
        f"/api/v1/tickets/{created['id']}",
        json={"status": "closed"},
        headers=admin_account.headers(),
    )
    assert res.status_code == 200, res.text
    # Admin closed it, but the agent is still the one who solved it.
    assert res.json()["resolved_by"]["id"] == agent.id
