# CivicChai QA Audit Report

**Audit date:** 2026-10-27  
**Audit scope:** Next.js application, API routes, client flows, Supabase migrations/schema, PWA assets, tests, and deployment documentation  
**Method:** Source review, route smoke tests, browser smoke tests, automated tests, TypeScript validation, production build

## Executive summary

The application builds successfully and the automated test suite passes. The main functional/privacy defect found is that the local fallback detail lookup does not apply the public-visibility filter, so a withdrawn issue can still be retrieved by its ID or document ID in the no-Supabase/demo path. One documentation defect also needs correction: the pilot readiness checklist says the required schema is version 7 although the application requires version 9.

No other confirmed runtime or authorization defect was found during this audit. Evidence uploads are correctly disabled in production by default, staff APIs require role/MFA checks, public issue responses use the redaction mapper, and the connected Supabase path has an `is_public` RLS policy.

## Findings

| ID | Severity | Status | File/lines | Finding | Recommendation |
|---|---|---|---|---|---|
| QA-001 | High | Confirmed | `lib/issues.ts:155-161` | `getIssueById()` returns any issue from the in-process fallback store when no client exists, regardless of `includeRestricted`. The public detail endpoint calls it with the default `false`, so a withdrawn issue (`isPublic === false`) remains discoverable by direct ID/document ID in local/demo mode. The public list filters these issues, creating inconsistent privacy behavior. | When `includeRestricted` is false, return only records whose `isPublic !== false`; add a regression test covering list and direct-detail access after withdrawal. |
| QA-002 | Low | Confirmed | `docs/PILOT_READINESS.md:25` | The go-live checklist says `/api/health` should report schema version 7, while `lib/deployment.ts:2`, migration 009, and the health endpoint require/report version 9. Operators following the document may treat a correctly migrated database as not matching the documented readiness procedure. | Change the documented version to 9 and update any remaining version-7 readiness references. |

## Security/privacy checks

- Public issue list/detail responses pass through `toPublicIssue()` and remove original text, reporter identity, evidence URLs, exact coordinates, and assignment fields.
- Connected Supabase RLS includes `is_public` filtering for public issue reads.
- Staff route authorization is present for analytics, audit, moderation, registry, QR, system health, status, and duplicate workflows.
- Staff MFA is checked in application authorization and database helper functions.
- Service-role usage is server-only; production paths fail closed when it is missing.
- Evidence uploads validate account state, size, MIME allowlist, and file signatures. Malware scanning remains an operational prerequisite and is documented as such.
- Rate-limit failures fail closed in configured/production deployments.
- Twilio IVR validates the signed request before creating or mutating a voice session.
- No secret was found in tracked files; `.env*.local` is ignored. Demo credentials are intentionally present in the demo-role source and must not be used for a real pilot.

## Functional QA evidence

### Automated checks

- `npm test` — passed; all discovered tests completed successfully.
- `npm run typecheck` — passed from a clean generated `.next` directory.
- `npm run build` — passed; all application routes compiled and generated.
- `git diff --check` — passed.

The first typecheck attempt failed because stale generated `.next/types/validator.ts` referenced a missing generated `routes.js`. Removing generated `.next` output and rerunning the same command passed; this is not reproducible from clean generated state.

### HTTP/API smoke tests

Verified locally against `http://127.0.0.1:3000`:

- Public pages and app routes returned HTTP 200: `/`, `/about`, `/chai-tapri`, `/citizen`, `/community-guidelines`, `/control-room`, `/how-it-works`, `/knowledge`, `/login`, `/mfa`, `/offline`, `/present`, `/privacy`, `/voice-agent`.
- Public APIs returned expected successful responses: `/api/health`, `/api/public/issues`, `/api/public/map`, `/api/public/trending`.
- Invalid public queries returned expected HTTP 400 responses: `/api/public/registry` without a PIN and `/api/coverage` without a PIN.
- Protected APIs rejected unauthenticated access: `/api/notifications` returned 401; `/api/analytics`, `/api/audit`, and `/api/system/health` returned 403.
- Unauthenticated issue creation returned 401 with the sign-in requirement.
- Spoofed demo role headers were rejected because the running environment had Supabase configuration and was not local-demo mode.

### Browser smoke tests

- Home page rendered with navigation, primary CTAs, branding, and responsive hero content.
- Navigation to `/citizen` rendered the local feed and report entry points.
- Browser console error capture found no console errors during `/citizen` load.
- Browser request-failure capture found no failed requests during `/citizen` load.

## File/surface coverage

### Application routes and UI

Reviewed layouts, pages, error boundaries, metadata routes, and presentation routes under `app/`, including citizen, authority, login/MFA, public issue, offline, privacy, knowledge, voice, and QR flows. No additional confirmed defect was found.

### API routes

Reviewed all tracked route handlers under `app/api/`: AI analysis, analytics, audit, coverage, evidence, geo lookup/reverse geocoding, GIS heatmap, health, issues and issue subresources, moderation, notifications, privacy requests, profile, public feeds, QR, registry, system health, and voice/IVR/TTS. Authorization, scope, redaction, rate limiting, and error handling were checked according to endpoint sensitivity.

### Shared libraries and components

Reviewed authentication/client construction, role and scope helpers, privacy/anonymity, issue storage, scoring, jurisdiction, geo, moderation, audit, notifications, offline queue/cache, QR, voice, analytics, and client API helpers. The confirmed fallback visibility issue is in `lib/issues.ts`; other reviewed helpers did not produce confirmed findings.

### Database and deployment

Reviewed migrations 001–009, consolidated schema, seed/apply scripts, deployment flags, Next/Vercel configuration, service worker, environment template, and pilot readiness documentation. The only confirmed documentation inconsistency is QA-002. Malware scanning, backups, restore drills, monitoring, incident response, and independent penetration testing remain deployment prerequisites rather than implemented application defects.

### Tests

Reviewed and executed the tracked test suite covering anonymity/maps, auth/errors, classification, jurisdiction, privacy, QR/analytics, scope, scoring, speech, voice calls, and withdrawal behavior. A regression test should be added for QA-001.

## Release recommendation

**Do not accept real public submissions until QA-001 is fixed and QA-002 is corrected.** After that, complete the documented pilot prerequisites: apply migrations through 009, disable demo mode, provision individual MFA-protected staff accounts, verify jurisdiction/registry data, establish upload scanning or keep uploads disabled, and run the authority-approved acceptance session.
