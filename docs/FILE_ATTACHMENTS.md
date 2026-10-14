# File Attachments

## Status: ❌ NOT IMPLEMENTED in v1

DeskFlow has **no attachment or file-upload functionality at all**. This is a
deliberate v1 scope decision, not an unfinished stub.

**What this means concretely, verified against the code:**

- There is no `attachments` collection in MongoDB and no attachment model in
  `backend/app/models/`.
- The FastAPI app registers **zero** upload/download routes. A test asserts this:
  `backend/tests/test_admin.py::test_no_attachment_routes_advertised` fails the build
  if any path containing `attachment` or `upload` ever appears in the OpenAPI schema.
- `python-multipart` (the form-upload dependency) is **not** in
  `backend/requirements.txt` — because no endpoint accepts `multipart/form-data`.
- The frontend has no upload component, no file input, and no attachment service
  module. Ticket descriptions and replies are **plain text only**.
- The frontend README explicitly lists attachment upload/download among
  "Intentionally not implemented in the UI (no backend flow exists — no fake
  buttons)".

**Rationale for the omission:** attachments require a binary storage decision
(GridFS vs. disk vs. object storage), MIME sniffing, size limits, malware
considerations, and a whole download-authorization surface. Shipping a half-working
upload endpoint would have been worse than shipping none — the project rule is "do
not expose fake endpoints."

## Future design (Planned — not built, not committed)

If attachments are added, the intended approach (for the record, not implemented):

1. **Storage:** GridFS (via the same PyMongo driver) for binary blobs, with an
   `attachments` collection holding metadata only (`ticket_id`, `message_id`,
   `uploader_id`, original filename, stored filename, MIME type detected
   server-side, size, `created_at`). GridFS keeps large binaries out of normal
   documents and avoids base64 bloat inside ticket records.
2. **Limits:** max file size and an allow-list of types (images, PDF, plain text)
   enforced from **sniffed** content — never trusting the client's `Content-Type`
   alone. Size from `MAX_UPLOAD_MB` environment variable.
3. **Authorization:** upload restricted to participants of the target ticket;
   download re-checks ticket visibility on every request (a customer can only fetch
   attachments on tickets they can see — same rule as messages).
4. **API shape (sketch only):** `POST /api/v1/tickets/{id}/attachments` (multipart),
   `GET /api/v1/attachments/{id}` with `Content-Disposition` and a safe filename.
5. **Dependency:** add `python-multipart` to requirements at that time.

None of the above exists today. Track it under
[DEVELOPMENT_ROADMAP.md](DEVELOPMENT_ROADMAP.md) if prioritized.

## Related documents

- [FEATURES.md](FEATURES.md) — feature status table
- [API_DOCUMENTATION.md](API_DOCUMENTATION.md#not-implemented-no-such-routes-exist)
- [REQUIREMENTS.md](REQUIREMENTS.md) — F-TKT-10 (attachment requirement, not met)
