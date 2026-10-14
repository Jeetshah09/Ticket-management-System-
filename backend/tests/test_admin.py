"""Admin-surface tests: categories, users, audit logs, analytics, health."""

from __future__ import annotations

import uuid


# ----------------------------- categories ----------------------------------


def test_any_user_can_list_active_categories(client, register_user, category):
    account = register_user("customer")
    res = client.get("/api/v1/categories", headers=account.headers())
    assert res.status_code == 200
    names = [c["name"] for c in res.json()["items"]]
    assert category["name"] in names


def test_inactive_categories_hidden_from_customers(client, register_user, admin_account):
    name = f"Hidden {uuid.uuid4().hex[:6]}"
    res = client.post(
        "/api/v1/categories",
        json={"name": name, "is_active": False},
        headers=admin_account.headers(),
    )
    assert res.status_code == 201
    hidden_id = res.json()["id"]

    customer = register_user("customer")
    res = client.get("/api/v1/categories", headers=customer.headers())
    assert all(c["id"] != hidden_id for c in res.json()["items"])

    # Admin can opt in to see inactive ones.
    res = client.get(
        "/api/v1/categories",
        params={"include_inactive": True},
        headers=admin_account.headers(),
    )
    assert any(c["id"] == hidden_id for c in res.json()["items"])


def test_customer_cannot_create_category(client, register_user, category):
    account = register_user("customer")
    res = client.post(
        "/api/v1/categories",
        json={"name": "Hacked"},
        headers=account.headers(),
    )
    assert res.status_code == 403


def test_agent_cannot_create_category(client, register_user, category):
    account = register_user("agent")
    res = client.post(
        "/api/v1/categories",
        json={"name": "Agent made this"},
        headers=account.headers(),
    )
    assert res.status_code == 403


def test_admin_can_update_category(client, admin_account):
    res = client.post(
        "/api/v1/categories",
        json={"name": f"Orig {uuid.uuid4().hex[:6]}", "description": "old"},
        headers=admin_account.headers(),
    )
    assert res.status_code == 201
    cat = res.json()

    res = client.patch(
        f"/api/v1/categories/{cat['id']}",
        json={"description": "updated", "is_active": False},
        headers=admin_account.headers(),
    )
    assert res.status_code == 200
    body = res.json()
    assert body["description"] == "updated"
    assert body["is_active"] is False


def test_duplicate_category_name_conflicts(client, admin_account, category):
    res = client.post(
        "/api/v1/categories",
        json={"name": category["name"]},
        headers=admin_account.headers(),
    )
    assert res.status_code == 409


def test_deactivated_category_keeps_ticket_references(
    client, register_user, admin_account, category
):
    """Deactivation must not break existing tickets."""
    customer = register_user("customer")
    res = client.post(
        "/api/v1/tickets",
        json={
            "subject": "Ref check",
            "description": "does the reference survive deactivation?",
            "category_id": category["id"],
            "priority": "low",
        },
        headers=customer.headers(),
    )
    assert res.status_code == 201
    ticket_id = res.json()["id"]

    res = client.patch(
        f"/api/v1/categories/{category['id']}",
        json={"is_active": False},
        headers=admin_account.headers(),
    )
    assert res.status_code == 200

    res = client.get(f"/api/v1/tickets/{ticket_id}", headers=customer.headers())
    assert res.status_code == 200
    assert res.json()["ticket"]["category"]["id"] == category["id"]


def test_unauthenticated_cannot_list_categories(client):
    assert client.get("/api/v1/categories").status_code == 401


# ------------------------------- users -------------------------------------


def test_customer_cannot_list_users(client, register_user, category):
    account = register_user("customer")
    assert client.get("/api/v1/users", headers=account.headers()).status_code == 403


def test_agent_cannot_list_users(client, register_user, category):
    account = register_user("agent")
    assert client.get("/api/v1/users", headers=account.headers()).status_code == 403


def test_admin_can_list_and_search_users(client, admin_account, register_user):
    target = register_user("customer")
    res = client.get(
        "/api/v1/users",
        params={"search": target.user["email"]},
        headers=admin_account.headers(),
    )
    assert res.status_code == 200
    items = res.json()["items"]
    assert any(u["id"] == target.id for u in items)
    # Password hashes never leave the API.
    assert "password_hash" not in res.text


def test_admin_can_change_role(client, admin_account, register_user):
    account = register_user("customer")
    res = client.patch(
        f"/api/v1/users/{account.id}",
        json={"role": "agent"},
        headers=admin_account.headers(),
    )
    assert res.status_code == 200
    assert res.json()["role"] == "agent"


def test_admin_cannot_deactivate_self(client, admin_account):
    res = client.patch(
        f"/api/v1/users/{admin_account.id}",
        json={"is_active": False},
        headers=admin_account.headers(),
    )
    assert res.status_code == 400


def test_admin_cannot_demote_self(client, admin_account):
    res = client.patch(
        f"/api/v1/users/{admin_account.id}",
        json={"role": "agent"},
        headers=admin_account.headers(),
    )
    assert res.status_code == 400


def test_update_user_unknown_id_is_404(client, admin_account):
    res = client.patch(
        "/api/v1/users/000000000000000000000000",
        json={"role": "agent"},
        headers=admin_account.headers(),
    )
    assert res.status_code == 404


def test_customer_cannot_update_other_users(client, register_user, category):
    alice = register_user("customer")
    bob = register_user("customer")
    res = client.patch(
        f"/api/v1/users/{bob.id}",
        json={"role": "admin"},
        headers=alice.headers(),
    )
    assert res.status_code == 403


# ----------------------------- audit logs ----------------------------------


def test_audit_logs_admin_only(client, register_user, category):
    customer = register_user("customer")
    assert client.get("/api/v1/audit-logs", headers=customer.headers()).status_code == 403
    agent = register_user("agent")
    assert client.get("/api/v1/audit-logs", headers=agent.headers()).status_code == 403
    assert client.get("/api/v1/audit-logs").status_code == 401


def test_audit_logs_record_login_and_ticket_events(
    client, admin_account, register_user, category
):
    account = register_user("customer")
    res = client.post(
        "/api/v1/tickets",
        json={
            "subject": "Audit me",
            "description": "This should be audited.",
            "category_id": category["id"],
            "priority": "medium",
        },
        headers=account.headers(),
    )
    assert res.status_code == 201

    res = client.get(
        "/api/v1/audit-logs",
        params={"action": "ticket.created"},
        headers=admin_account.headers(),
    )
    assert res.status_code == 200
    entries = res.json()["items"]
    assert entries, "expected ticket.created audit entries"
    assert all(e["action"].startswith("ticket.created") for e in entries)
    # Actor is hydrated.
    assert any(e["actor"] and e["actor"]["id"] == account.id for e in entries)
    # No secrets in audit payloads.
    assert "password" not in res.text.lower()
    assert "token" not in res.text.lower()


def test_audit_log_filters_by_actor(client, admin_account, register_user, category):
    account = register_user("customer")
    client.post(
        "/api/v1/tickets",
        json={
            "subject": "Actor filter",
            "description": "x",
            "category_id": category["id"],
            "priority": "low",
        },
        headers=account.headers(),
    )
    res = client.get(
        "/api/v1/audit-logs",
        params={"actor_id": account.id},
        headers=admin_account.headers(),
    )
    assert res.status_code == 200
    entries = res.json()["items"]
    assert entries
    assert all(e["actor"] and e["actor"]["id"] == account.id for e in entries)


# ------------------------------ analytics ----------------------------------


def test_analytics_overview_customer_scoped(client, register_user, category):
    alice = register_user("customer")
    bob = register_user("customer")
    for account in (alice, bob):
        client.post(
            "/api/v1/tickets",
            json={
                "subject": f"Ticket for {account.role}",
                "description": "x",
                "category_id": category["id"],
                "priority": "medium",
            },
            headers=account.headers(),
        )

    res = client.get("/api/v1/analytics/overview", headers=alice.headers())
    assert res.status_code == 200
    body = res.json()
    # Alice sees exactly her own tickets.
    assert body["total_tickets"] == 1
    assert "total_users" not in body or body["total_users"] is None
    assert isinstance(body["by_status"], list)
    assert isinstance(body["by_priority"], list)
    assert len(body["created_trend"]) == 14


def test_analytics_overview_admin_sees_more(client, admin_account, register_user, category):
    customer = register_user("customer")
    client.post(
        "/api/v1/tickets",
        json={
            "subject": "admin sees it",
            "description": "x",
            "category_id": category["id"],
            "priority": "high",
        },
        headers=customer.headers(),
    )
    res = client.get("/api/v1/analytics/overview", headers=admin_account.headers())
    assert res.status_code == 200
    body = res.json()
    assert body["total_tickets"] >= 1
    assert body["total_users"] >= 1
    assert body["total_categories"] >= 1
    assert body["unassigned_tickets"] >= 0


def test_agent_workloads_admin_only(client, register_user, category):
    agent = register_user("agent")
    assert client.get("/api/v1/analytics/agents", headers=agent.headers()).status_code == 403
    assert client.get("/api/v1/analytics/agents").status_code == 401


def test_agent_workloads_include_assigned_counts(
    client, admin_account, register_user, category
):
    customer = register_user("customer")
    agent = register_user("agent")
    res = client.post(
        "/api/v1/tickets",
        json={
            "subject": "Workload ticket",
            "description": "x",
            "category_id": category["id"],
            "priority": "medium",
        },
        headers=customer.headers(),
    )
    ticket_id = res.json()["id"]
    res = client.post(
        f"/api/v1/tickets/{ticket_id}/assign",
        json={"assignee_id": agent.id},
        headers=agent.headers(),
    )
    assert res.status_code == 200

    res = client.get("/api/v1/analytics/agents", headers=admin_account.headers())
    assert res.status_code == 200
    rows = res.json()
    match = [r for r in rows if r["agent"]["id"] == agent.id]
    assert match and match[0]["total_tickets"] >= 1


# -------------------------------- health -----------------------------------


def test_health_endpoint(client):
    res = client.get("/api/v1/health")
    assert res.status_code == 200
    body = res.json()
    assert body["status"] == "ok"
    assert body["database"] == "ok"
    # No sensitive diagnostics.
    for banned in ("uri", "secret", "password", "host"):
        assert banned not in res.text.lower()


# --------------------------- openapi integrity ------------------------------


def test_openapi_schema_is_generated(client):
    res = client.get("/openapi.json")
    assert res.status_code == 200
    paths = res.json()["paths"]
    # The advertised surface exists in the schema.
    for path in (
        "/api/v1/auth/register",
        "/api/v1/auth/login",
        "/api/v1/auth/me",
        "/api/v1/tickets",
        "/api/v1/tickets/{ticket_id}",
        "/api/v1/tickets/{ticket_id}/messages",
        "/api/v1/tickets/{ticket_id}/assign",
        "/api/v1/categories",
        "/api/v1/notifications",
        "/api/v1/notifications/{notification_id}/read",
        "/api/v1/analytics/overview",
        "/api/v1/audit-logs",
        "/api/v1/users",
        "/api/v1/health",
    ):
        assert path in paths, f"missing route in OpenAPI: {path}"


def test_no_attachment_routes_advertised(client):
    """Attachments are intentionally out of scope for v1 — make sure we
    don't advertise fake endpoints."""
    res = client.get("/openapi.json")
    paths = res.json()["paths"]
    assert not any("attachment" in p for p in paths)
    assert not any("upload" in p for p in paths)
