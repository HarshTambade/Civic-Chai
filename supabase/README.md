# CivicChai Supabase setup

This folder contains the Postgres schema, incremental migrations, and synthetic demo issue data for the two-portal application.

## Fresh project

1. Create a Supabase project and copy its project URL and anon key.
2. Apply the migrations in order: `migrations/001_init.sql`, `migrations/002_civicchai_platform.sql`, `migrations/003_pilot_hardening.sql`, `migrations/004_staff_mfa_rls.sql`, `migrations/005_pilot_workflow.sql`, `migrations/006_anonymous_handles.sql`, `migrations/007_service_area_pins.sql`, then `migrations/008_reporter_withdrawal.sql`. The combined `schema.sql` is also provided for a fresh SQL Editor import.
3. Run `seed.sql` for clearly labeled synthetic civic issues. No real public official, phone number, legal citation, hub, or service target is seeded or treated as verified.
4. In the app, set `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_URL`, and the server-only `SUPABASE_SERVICE_ROLE_KEY`. The legacy `NEXT_PUBLIC_SUPABASE_ANON_KEY` is also accepted. Never expose the service role key to the browser.
5. Run `npm run seed:demo-users` with `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` set to create one Supabase Auth account for every product role.

## Demo users

All provisioned demo accounts use `CivicChai!2026` as the password. Accounts are scoped to the demo PIN 401208 where appropriate. Change or delete every demo account before a public deployment.

| Role | Demo email |
| --- | --- |
| Citizen | `citizen@civicchai.local` |
| Moderator | `moderator@civicchai.local` |
| Department operator | `operator@civicchai.local` |
| Department supervisor | `supervisor@civicchai.local` |
| Authority administrator | `authority@civicchai.local` |
| System administrator | `system-admin@civicchai.local` |
| Auditor | `auditor@civicchai.local` |

Without Supabase configuration, the same accounts are available in the browser-only demo session. That mode is for UI review and is not secure authentication or durable storage.

In connected mode, every non-citizen role must set up a TOTP authenticator at first sign-in. The API verifies Supabase AAL2 before granting staff-role access. Replace the shared demo password and use individual accounts before real pilot records are entered.

The unconfigured local demo starts with an empty issue feed; it no longer injects hard-coded mock complaints. `seed.sql` remains the intentional source of synthetic sample issues for a connected demo database. They are tagged `is_demo` and omitted from live heatmap calculations.

## Database capabilities

The migrations create roles and scoped RBAC, issue/report/evidence records, community support, comments and moderation reports, reversible duplicate links, separate priority and evidence-trust factors, status history, verified hub/officer/document registries, optional SLA targets, notifications, audit records, a private evidence bucket, and an IVR session table. Public Supabase reads are restricted to feed-safe columns; exact coordinates, reporter identity, raw complaint text, and private evidence remain server-side.

## Authority registry and legal education

Authority administrators must add an official HTTPS source and explicitly mark a record verified. The registry UI accepts only HTTPS URLs and only allows `.gov.in` or `.nic.in` sources to be marked verified. Unverified contacts, legal material, and SLAs are not presented to citizens. A CivicChai-hosted copy is still not represented as the issuing authority's original document.

## Production configuration

The application can serve as a civic intake and workflow platform, but a live government deployment still needs the jurisdiction's official contact registry, approved privacy/retention notices, authority-specific verified SLAs and legal documents, telephony provider credentials/number, storage malware scanning, backups, monitoring, and security/legal review. The app does not claim to be a statutory grievance or appeal channel. Apply migrations 003, 004 and 005 before deploying this release (the health check requires schema version 8; also apply 006, 007 and 008); they restrict direct staff table writes, require MFA for staff database access, record issue actions and audit events transactionally, enforce role-specific transitions, and snapshot verified area labels for queue filters. Production issue intake and evidence uploads remain disabled until their `CIVICCHAI_*_ENABLED` deployment flags are explicitly enabled after readiness review.
