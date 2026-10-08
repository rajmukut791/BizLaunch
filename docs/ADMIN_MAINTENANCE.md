# Admin platform care

The Admin workspace has a premium overview, real platform metrics, a seven-day order chart in Asia/Dhaka, review queues and quick links. Open /admin/maintenance for Maintenance studio.

Maintenance settings are stored in MongoDB and default to Online. Administrators can edit the headline/message, preview the visitor experience, pause commerce, and optionally schedule reopening within the next 30 days. The browser displays the time in its local timezone.

During maintenance, customer, seller and anonymous commerce requests receive HTTP 503 with a MAINTENANCE code and Retry-After header. The frontend shows the visitor message. Valid, active, email-verified administrators keep access. Sign-in, sign-out, registration, email verification, password recovery, health/readiness and public availability status remain available.

This pauses new commerce requests; requests already accepted can finish. Existing accounts, orders, stock and uploads are preserved. Maintenance is for application availability, not a substitute for database migration procedures.

Settings updates use a version check so simultaneous administrator edits cannot silently overwrite one another. The most recent 20 changes record the actor and time. Scheduled windows automatically reopen on the next settings/commerce request after the end time, with a system activity entry. Visitor pages recheck availability every 30 seconds while visible, on window focus, and when a paused API request is encountered.

Endpoints:

- GET /api/platform/status — public, message and availability only; no history or actor details.
- GET /api/admin/maintenance — verified admin, settings and activity.
- PATCH /api/admin/maintenance — verified admin; enabled (boolean), title (3–90 characters), message (10–600), endsAt (optional future ISO date), version (integer).

Maintenance changes and restoration are tested in isolated test databases. Normal development data is not paused by automated tests.
