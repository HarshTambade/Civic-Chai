# CivicChai SOP coverage and pilot readiness

This is the implementation audit for `CivicChai_PS2_Master_SOP_v2_Two_Portals.pdf`. It separates working product paths from deployment and jurisdiction decisions that must be supplied by the pilot authority. A running website alone does not mean a jurisdiction is ready to accept real grievances.

## SOP coverage in this release

| SOP area | Version 1 implementation | Pilot boundary |
| --- | --- | --- |
| Citizen portal and Chai Tapri | Citizen home, local issue feed, issue filing, tracking, comments, support/follow, report and profile/data-rights entry points. | Public feed text is redacted; precise coordinates and private evidence are not public. Notifications are in-app; email, SMS and web-push delivery are not integrated. |
| Role-based authority portal | Separate views for moderator, department operator, department supervisor, authority administrator, system administrator and auditor. Staff actions are scoped and role-specific. | Provision real accounts with the least privilege, jurisdiction and department. Administrative accounts must enroll in TOTP MFA. |
| Intake channels | Typed web/PWA intake, browser speech recognition, assisted reporting, and a Twilio-compatible DTMF/voice IVR with confirmation and correction steps. | IVR needs an approved Twilio number, callback URL and credentials. Browser speech recognition depends on the user's browser and is not a retained audio recording. The SOP's QR-to-locality mapping is not implemented; citizens enter a PIN and locality manually. |
| Classification | Local deterministic taxonomy with confidence and human confirmation; optional Groq classification only after online-processing consent. | The deterministic model is a baseline classifier, not a validated production model. Staff should review category and routing during the pilot. |
| Duplicate handling | Same-PIN candidates are ranked using wording, locality, category/department, report age and evidence presence. Staff review is required; merge and unmerge preserve separate source reports. | Similarity is lexical and heuristic; evidence is presence-only. It is not a semantic embedding, image-match or automatic merge system. |
| Priority and trust | Separate deterministic priority and report-evidence trust factors; citizen support does not create a citizen reputation score. | Recalibrate weights with the pilot authority and publish the explanation before using scores operationally. |
| Routing and civic information | Verified hub, officer, legal-document and SLA registries; issue actions have a transactional audit event. Verified issue-area labels drive state/district/municipality/ward filters. | Registry starts empty. Enter and verify official contacts, jurisdiction mappings, law/service documents and SLA sources before using those features. No statutory deadline is inferred. |
| Mapping and privacy | Leaflet heatmap uses approximate/aggregated locations; exact coordinates are available only to authorized staff. | Verify the jurisdiction's map tiles, geographic precision and privacy notice. No public exact-address map is exposed. |
| PWA and offline | Installable PWA, app shell, offline report drafts with explicit consent, pending-sync state, and public read cache. Writes are not queued to an authority without later authenticated sync. | Staff operations are online-only. Citizens must understand that an offline draft is not yet filed. |
| Moderation and recourse | Content reports, review decisions and appeals have role-scoped workflows; public display can be hidden while preserving the report record. | Define moderator coverage, response targets and appeal handling for the pilot. |
| Data rights | Access, correction, erasure and grievance requests are captured, visible to system administrators and have an outcome record. | Fulfillment is a human compliance action; the app does not automatically export or erase records. Approve identity checks and retention rules, and document the action before marking fulfilled. |
| Platform security | Production demo identities are disabled; no-Supabase production requests fail closed; shared rate limits fail closed; staff MFA is enforced in API authorization and database RLS; sensitive issue updates use a service-only transaction; production intake and uploads are gated; evidence type signatures and account ownership are checked; standard security headers are set. | Malware scanning, backups/restore drills, monitoring, incident response and an independent penetration/security review require operational services and owners. |

## Required before real pilot submissions

1. Apply `supabase/migrations/001_init.sql`, `002_civicchai_platform.sql`, `003_pilot_hardening.sql`, `004_staff_mfa_rls.sql`, `005_pilot_workflow.sql` and `006_anonymous_handles.sql` in order (or import the complete `supabase/schema.sql` into a new project).
2. Configure the production Supabase URL, publishable key and server-only service role key. Confirm `/api/health` reports ready (schema version 6) and `/api/system/health` reports the database connected.
3. Rotate any Supabase service-role or Groq credentials that were shared outside the secret manager, and store the replacement only in deployment secrets. Never commit `.env.local`.
4. Set `NEXT_PUBLIC_CIVICCHAI_DEMO_MODE=false` so `/login` does not list shared credentials and demo staff accounts require MFA. Replace shared demo passwords, remove unused demos, provision individual staff accounts, set jurisdiction/department scope, and enroll each staff account in TOTP MFA. Use demo accounts only in a controlled pilot environment.
5. Enter authority-approved, source-verified jurisdiction/hub/department/officer records, public contacts, lawful privacy notice, retention/deletion rules, and applicable legal/service-standard documents. Keep the registry unverified until the source is checked.
6. Decide who operates moderation, privacy requests, duplicate reviews, assignment, escalation and incident response. Record the applicable response and escalation targets.
7. Configure and test Twilio only if phone intake is part of this pilot. Confirm the callback URL, number, credentials, consent recording, DTMF fallback, correction and final readback.
8. Connect an upload scanning service or disable evidence uploads for the pilot until the authority has approved its malware-handling process. Current file checks validate declared media signatures and size; they do not scan for malware. Files are capped at 4 MB per item to fit the hosted API upload path.
9. Configure automated database backups, test a restore, monitor application/database errors, define a security incident contact and run an independent security review.
10. Run a jurisdiction-approved acceptance session covering every role, out-of-scope access, public redaction, real mobile install/offline sync, voice/DTMF, duplicate merge/unmerge, status evidence, notifications, keyboard/screen-reader use and a lost-device/data-rights scenario.

Do not represent CivicChai as a statutory grievance, appeal or emergency channel unless the responsible authority has formally approved that use and its integrations. Provide the authority's existing emergency and grievance channels in the pilot notice.

Production issue and phone intake stay disabled unless `CIVICCHAI_PUBLIC_INTAKE_ENABLED=true`. Evidence uploads stay disabled unless `CIVICCHAI_EVIDENCE_UPLOADS_ENABLED=true`; enable them only after the approved file-scanning or handling workflow is operating.

## Pilot workflow decisions in this release

- Web filing requires a signed-in account (citizen, or department staff recorded as `assisted` filing). Anonymous intake remains available only through the signed telephony webhook.
- The department is derived on the server from the citizen-confirmed category; `keypad` is reserved for the IVR route.
- Resolution needs a public resolution note (15+ characters) or an official `.gov.in`/`.nic.in` record; a supplied URL must still be official.
- Joining a suggested duplicate adds one support and one corroborating report per account; reviewers still decide merges.
- Moderation decisions require a documented note; only the reporter can move a report to `appealed`.
- Authority administrators can verify or withdraw verification of existing registry records; only official-domain sources can be verified.
- Citizens appear publicly only by an anonymous handle such as `KadakKulhad-3F9A`; sign-up no longer asks for a real name.
- "Use my current location" sends the device coordinates once to the configured Nominatim service to suggest the PIN and locality; the citizen confirms them. Exact coordinates are stored only when attached to a report and are visible only to authorized staff. The public community map groups reports into cells of about 1 km. List OpenStreetMap/Nominatim and the India Post PIN lookup as processors in the privacy notice.
- STREE's optional on-device model runs with a system prompt that forbids inventing laws, officials, contacts or deadlines, and is hidden on staff and sign-in screens.

## Local verification performed for this audit

- TypeScript project check: `npm run typecheck -- --incremental false`.
- Unit tests: `npm test` (classification, scoring, duplicate safety, redaction, heatmap, timeline).
- Production build: `npm run build`.
- An API walkthrough of the 401208 scenario in local preview: filing, duplicate suggestion, join, acknowledge, resolve, citizen verification, close, timeline, moderation, privacy request and audit.
- No browser, accessibility or security automation is included. Passing these checks does not replace the acceptance session above.
