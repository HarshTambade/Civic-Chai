# ☕ CivicChai — Detailed Project README

> **India mein har ek Charcha Chai Pe hoti hai.**
>
> **CivicChai turns every civic grievance into a community-powered Charcha, where AI understands the problem, citizens decide how hot the Chai is, and authorities get a structured, prioritized and trackable civic issue.**

## Run the included application

The runnable Next.js app, PWA, API routes and Supabase setup are in this repository. Copy .env.example to .env.local; for a local UI demo, leave Supabase settings blank and sign in with any role account in the login screen. The local demo uses browser storage and is not durable authentication.

For a connected deployment, apply supabase/migrations/001_init.sql and supabase/migrations/002_civicchai_platform.sql in order, then supabase/seed.sql. Set the Supabase values in .env.local, run npm run seed:demo-users, then npm run dev. The role demo accounts and their shared password are documented in the Supabase setup guide.

The registry starts empty because the SOP prohibits invented public contacts, legal references and SLAs. Sign in as the authority administrator, create the jurisdiction, and add source-backed hub, office, document and optional service-target records before presenting them as verified.

---

# 📌 Table of Contents

1. [Overview](#-overview)
2. [Problem Statement](#-problem-statement)
3. [Our Solution](#-our-solution)
4. [Why CivicChai?](#-why-civicchai)
5. [Core Philosophy](#-core-philosophy)
6. [Product Architecture](#-product-architecture)
7. [Two-Portal Architecture](#-two-portal-architecture)
8. [Citizen Portal](#-citizen-portal)
9. [Government Administration Dashboard](#-government-administration-dashboard)
10. [Chai Tapri Social Layer](#-chai-tapri-social-layer)
11. [Complaint Filing](#-complaint-filing)
12. [Multilingual Voice AI](#-multilingual-voice-ai)
13. [Keypad Phone Support](#-keypad-phone-support)
14. [AI Complaint Classification](#-ai-complaint-classification)
15. [Duplicate Complaint Detection](#-duplicate-complaint-detection)
16. [Chai Heat](#-chai-heat)
17. [Priority Engine](#-priority-engine)
18. [Trust / Evidence Score](#-trust--evidence-score)
19. [Civic Report Generation](#-civic-report-generation)
20. [Civic Education Engine](#-civic-education-engine)
21. [Department & Officer Routing](#-department--officer-routing)
22. [PIN-Code Hub System](#-pin-code-hub-system)
23. [Complaint Tracking](#-complaint-tracking)
24. [GIS & Civic Hotspots](#-gis--civic-hotspots)
25. [WebLLM & Hybrid AI](#-webllm--hybrid-ai)
26. [Offline Architecture](#-offline-architecture)
27. [System Architecture](#-system-architecture)
28. [Data Architecture](#-data-architecture)
29. [Security](#-security)
30. [Privacy](#-privacy)
31. [Compliance](#-compliance)
32. [AI Governance](#-ai-governance)
33. [Anti-Spam & Anti-Manipulation](#-anti-spam--anti-manipulation)
34. [Accessibility](#-accessibility)
35. [Technology Stack](#-technology-stack)
36. [API Architecture](#-api-architecture)
37. [Example End-to-End Flow](#-example-end-to-end-flow)
38. [Dashboard Metrics](#-dashboard-metrics)
39. [Database Schema](#-database-schema)
40. [Project Structure](#-project-structure)
41. [MVP](#-mvp)
42. [Future Roadmap](#-future-roadmap)
43. [Testing](#-testing)
44. [KPIs](#-kpis)
45. [Deployment](#-deployment)
46. [Contribution Guidelines](#-contribution-guidelines)
47. [Legal Disclaimer](#-legal-disclaimer)
48. [Vision](#-vision)

---

# ☕ Overview

**CivicChai** is an AI-powered civic grievance and social participation platform designed to make reporting civic problems as easy and familiar as having a conversation at an Indian chai tapri.

Instead of treating a grievance as a boring government ticket, CivicChai transforms it into a **community-driven civic discussion**.

A citizen can:

* Type a complaint
* Speak a complaint
* Upload photographs/videos
* Provide supporting documents
* Use a smartphone
* Use a web browser
* Call CivicChai from a keypad phone
* View existing local issues
* Upvote existing complaints
* Comment and add evidence
* Track complaints
* Understand which department handles the issue
* Find the responsible office/hub
* Learn about the relevant public process
* View the complete complaint report

At the same time, government administrators receive a structured dashboard where complaints are:

* Classified
* Categorized
* Geographically grouped
* Deduplicated
* Prioritized
* Routed
* Tracked
* Analysed

---

# 🎯 Problem Statement

Traditional grievance systems often suffer from several problems:

### 1. Fragmented complaints

100 citizens may report the same pothole independently.

```text
Citizen 1 → Complaint A
Citizen 2 → Complaint B
Citizen 3 → Complaint C
...
Citizen 100 → Complaint Z
```

The administration sees 100 tickets instead of one underlying civic problem.

---

### 2. Language barriers

Citizens may report problems using:

* Hindi
* Marathi
* English
* Hinglish
* Regional languages
* Code-mixed speech

Traditional forms are often optimized for structured English-language input.

---

### 3. Lack of prioritization

A government department may receive thousands of complaints but struggle to understand:

> Which problem is actually affecting the community the most?

---

### 4. Poor transparency

Citizens often do not know:

* Which department received the complaint
* Which jurisdiction handles it
* Where the office is
* Who is responsible
* What process applies
* What happens next

---

### 5. Digital divide

A smartphone-only platform excludes people using:

* Basic phones
* Keypad phones
* Voice calls
* Low-bandwidth connections

---

### 6. Lack of civic context

A citizen may know:

> "There is a problem."

But not:

> "Which department is responsible?"

> "Where do I go?"

> "What public process applies?"

> "How do I follow up?"

CivicChai attempts to solve all of these problems in a single platform.

---

# 🚀 Our Solution

CivicChai introduces a new model:

```text
                CITIZEN
                   │
                   ▼
          TEXT / VOICE / CALL
                   │
                   ▼
            AI UNDERSTANDS
                   │
                   ▼
        CLASSIFICATION + LOCATION
                   │
                   ▼
          DUPLICATE DETECTION
             /            \
           YES             NO
            │               │
            ▼               ▼
     SUPPORT EXISTING      CREATE
        CHARCHA            ISSUE
            │               │
            └───────┬───────┘
                    ▼
             COMMUNITY SUPPORT
                    │
                    ▼
               CHAI HEAT 🔥
                    │
                    ▼
             PRIORITY ENGINE
                    │
                    ▼
          DEPARTMENT / OFFICER
                    │
                    ▼
               GOVERNMENT
                    │
                    ▼
                ACTION
                    │
                    ▼
               RESOLUTION
                    │
                    ▼
             CITIZEN VERIFICATION
```

---

# 🇮🇳 Why CivicChai?

The fundamental idea is based on a familiar Indian social experience:

## The Chai Tapri

A chai tapri is more than a place to drink tea.

It is where people:

* Talk
* Debate
* Share information
* Discuss local problems
* Exchange opinions
* Discuss politics
* Discuss cricket
* Discuss their neighborhood

CivicChai takes that concept digital.

### Physical world

**Chai Tapri → Charcha → Community awareness**

### CivicChai

**Chai Tapri → Digital Charcha → Civic action**

---

# 🫖 Core Philosophy

Every concept in CivicChai is connected to the Chai metaphor.

| CivicChai              | Meaning               |
| ---------------------- | --------------------- |
| ☕ Chai                 | Civic issue           |
| 💬 Charcha             | Discussion            |
| 🔥 Chai Heat           | Community support     |
| 🫖 Chai Tapri          | Trending civic issues |
| 📍 Local Chai          | Locality-based feed   |
| ➕ Pour a Chai          | File a grievance      |
| 👥 Chai Community      | Citizens              |
| 🧠 AI Chaiwala         | AI engine             |
| 🏛️ Civic Control Room | Government dashboard  |

The metaphor should remain understandable even to someone who has never used the platform.

---

# 🏗️ Product Architecture

CivicChai consists of two primary portals.

```text
                         CIVICCHAI
                            │
                ┌───────────┴───────────┐
                │                       │
                ▼                       ▼
        CITIZEN PORTAL          GOVERNMENT PORTAL
                │                       │
                └───────────┬───────────┘
                            ▼
                       CORE BACKEND
                            │
       ┌────────────┬───────┼──────────┬────────────┐
       ▼            ▼       ▼          ▼            ▼
      NLP        Duplicate  Priority   GIS        Documents
       │         Engine     Engine      │            │
       └────────────┬────────┴──────────┘            │
                    ▼                                │
              AI ORCHESTRATOR ◄─────────────────────┘
                    │
           ┌────────┴────────┐
           ▼                 ▼
      Local/WebLLM       Online AI
```

---

# 👥 Two-Portal Architecture

## Portal 1 — Citizen Portal

Designed around:

> **Discovery → Charcha → Complaint → Support → Tracking**

The interface should feel like a social platform.

---

## Portal 2 — Government Dashboard

Designed around:

> **Monitor → Classify → Prioritize → Assign → Resolve → Analyse**

The interface should feel like an operational control room.

---

# 📱 Citizen Portal

The citizen application contains four major navigation areas.

## 1. Local Chai

The home feed.

Shows civic issues around the citizen's locality.

Example:

```text
☕ LOCAL CHAI

PIN 401208

🔥 Station Road Potholes
94° Chai Heat

2,431 supporters
87 reports

Road Department
Status: Assigned

[🔥 Support] [💬 Charcha]
```

---

## 2. Chai Tapri

Trending issues.

Users can discover:

* Hottest issues
* Rising issues
* Nearby issues
* Unresolved issues

---

## 3. My Charcha

Contains:

* Filed complaints
* Tracking
* Upvoted complaints
* Followed complaints
* Resolved complaints

---

## 4. Profile

Contains:

* Profile
* Locality
* Language
* Complaint history
* Supported issues
* Notifications
* Privacy
* Accessibility
* Settings

---

# ➕ Complaint Filing

The central `+` button is the most important action.

Label:

> **Pour a Chai**

Options:

```text
📝 Type
🎙 Record
📷 Add Proof
📞 Call CivicChai
```

---

# 🎙 Multilingual Voice AI

Users should not have to type.

Example:

> "Station road var khup motha khadda aahe."

The system processes:

```text
Language:
Marathi

Intent:
Civic Complaint

Category:
Roads

Issue:
Pothole

Location:
Station Road

PIN:
401208

Department:
Roads Department
```

---

# 📞 Keypad Phone Support

CivicChai is designed to work even without smartphones.

### Call flow

```text
CALL
 │
 ▼
LANGUAGE
 │
 ▼
PROBLEM
 │
 ▼
LOCATION
 │
 ▼
PIN
 │
 ▼
PROOF?
 │
 ▼
AI SUMMARY
 │
 ▼
CONFIRM
 │
 ▼
COMPLAINT CREATED
 │
 ▼
DOCUMENT ID
```

Example:

> "Aapki shikayat hai ki Station Road par 15 din se streetlights band hain."

Citizen:

> "Haan."

System:

> "Aapki complaint successfully register ho gayi hai. Complaint ID CC-401208-2026-0001842 hai."

---

# 🧠 AI Complaint Classification

The NLP engine extracts:

* Language
* Intent
* Category
* Subcategory
* Location
* Time
* Severity
* Department
* Required evidence
* Potential duplicate

Example:

```json
{
  "language": "hinglish",
  "category": "public_lighting",
  "subcategory": "streetlight_outage",
  "location": "Station Road",
  "pincode": "401208",
  "duration": "15 days",
  "department": "municipal_lighting",
  "confidence": 0.94
}
```

---

# 🔁 Duplicate Complaint Detection

This is one of CivicChai's core features.

Suppose someone submits:

> "Station Road ki streetlights 15 din se band hain."

AI finds:

> **Similar Charcha already exists.**

Instead of rejecting the citizen:

```text
☕ Yeh Chai pehle se chal rahi hai!

Station Road Streetlights

1,842 supporters
52 reports
17 days unresolved

🔥 92° Chai Heat

[Support Existing Issue]

[This is a different problem]
```

---

# 🧬 Duplicate Detection Architecture

Duplicate detection combines:

### Semantic similarity

Does the complaint mean the same thing?

### Geographic similarity

Is it happening in the same location?

### Category similarity

Is it the same type of civic problem?

### Time similarity

Is the complaint referring to the same incident?

### Evidence similarity

Are the photographs/videos potentially related?

---

## Important principle

AI should **suggest** a duplicate.

It should not blindly reject a citizen.

This prevents false positives.

---

# 🔥 Chai Heat

Chai Heat is CivicChai's community-support mechanism.

It represents:

> **How strongly the community is talking about/supporting this issue.**

Example:

```text
☕ CHAI HEAT

94°

🔥🔥🔥🔥🔥

2,431 supporters
87 citizen reports
17 days unresolved
```

Chai Heat can consider:

* Upvotes
* Independent reports
* Recent growth
* Community activity
* Geographic concentration
* Spam/manipulation signals

---

# ⚠️ Chai Heat ≠ Priority

These must remain separate.

### Chai Heat

> Community support.

### Priority

> Actual civic urgency/importance.

### Trust

> Confidence in the evidence/report.

Therefore:

```text
Chai Heat: 94
Priority: 88
Evidence Confidence: 82
```

A dangerous issue should remain high priority even if few citizens have discovered it.

---

# 🚨 Priority Engine

Recommended initial factors:

| Factor                | Weight |
| --------------------- | -----: |
| Severity / urgency    |    25% |
| Community support     |    25% |
| Independent reports   |    15% |
| Persistence           |    10% |
| Geographic impact     |    10% |
| Evidence quality      |    10% |
| Authority/SLA context |     5% |

Example:

```text
Severity          23/25
Community         22/25
Reports           13/15
Persistence        9/10
Geography          8/10
Evidence           8/10
SLA                4/5
--------------------------------
Priority           87/100
```

---

# 🛡️ Trust / Evidence Score

CivicChai should never create a social-credit-style citizen score.

Instead:

> **Report Confidence / Evidence Confidence**

Possible signals:

* Proof attached
* Location consistency
* Independent corroboration
* Evidence quality
* Description consistency
* Spam/anomaly indicators

A low-confidence report should still be allowed into the system.

---

# 📄 Civic Report

Every accepted complaint should become a structured CivicChai report.

Example:

```text
━━━━━━━━━━━━━━━━━━━━━━━━━━━━

☕ CIVICCHAI CIVIC REPORT

Document ID:
CC-401208-2026-0001842

ISSUE
Station Road Streetlight Outage

LOCATION
PIN 401208

CATEGORY
Public Lighting

DEPARTMENT
Municipal Public Lighting

JURISDICTION
Ward X

OFFICIAL OFFICE
Verified Municipal Hub

CONTACT
Officially published contact

PRIORITY
88 / 100

EVIDENCE CONFIDENCE
82 / 100

CHAI HEAT
94°

REPORTS
87

SUPPORTERS
2,431

STATUS
IN PROGRESS

━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

---

# 🎓 Civic Education Engine

After filing, CivicChai explains:

> **"Samjho tumhari Chai kahan ja rahi hai."**

The system explains:

### What is the problem?

Streetlight outage.

### Which department?

Public Lighting.

### Which jurisdiction?

PIN 401208 / Ward X.

### Where is the hub?

Verified local hub.

### Who handles it?

Officially published designated office/role.

### What public process applies?

Relevant verified public service information.

### What happens next?

Assignment → action → resolution → verification.

---

# ⚖️ Legal Information

The system should use verified sources.

Never allow an LLM to simply invent:

* Laws
* Sections
* Officers
* Government contacts
* Government procedures

Every reference should have:

```text
Authority
Document ID
Publication date
Effective date
Version
Source
Verification date
```

And:

> **“This information is provided for civic education and does not constitute legal advice.”**

---

# 🏢 Department & Officer Routing

The AI identifies the responsible department.

Example:

```text
Problem
   ↓
Streetlight
   ↓
Public Lighting
   ↓
Municipality
   ↓
Ward
   ↓
PIN 401208
   ↓
Relevant Hub
   ↓
Official Office / Designated Officer
```

The routing database should be version controlled.

---

# 📍 PIN-Code Hub System

Each locality can have a civic hub.

Example:

```text
PIN:
401208

Locality:
Demo Locality

Ward:
X

Authority:
Municipal Corporation

Hub:
Civic Service Hub

Address:
Officially verified address

Contact:
Officially published contact

Last verified:
01 Sep 2026
```

QR codes can point citizens toward their locality.

### Important

A QR code should identify a locality/service context.

It should **not automatically be treated as proof of residency**.

---

# 📈 Complaint Tracking

Every complaint receives a status timeline.

```text
✓ Filed
   ↓
✓ AI Classified
   ↓
✓ Duplicate Checked
   ↓
✓ Department Assigned
   ↓
✓ Officer/Office Acknowledged
   ↓
● In Progress
   ↓
○ Resolved
   ↓
○ Citizen Verified
   ↓
○ Closed
```

---

# 🗺️ GIS & Civic Hotspots

CivicChai can aggregate complaints geographically.

Example:

```text
401208

Road Problems       ██████████
Streetlights        ███████
Garbage             █████
Water               ████
Drainage            ███
```

The system can generate:

* Locality hotspots
* Ward hotspots
* Department hotspots
* Issue-density maps
* Priority maps
* Resolution maps

Public maps should use appropriate location generalization.

---

# 🧠 WebLLM + Hybrid AI

CivicChai uses a hybrid AI architecture.

```text
                USER
                  │
                  ▼
           LOCAL PROCESSING
             / WebLLM
                  │
         ┌────────┴────────┐
         │                 │
      SIMPLE             COMPLEX
         │                 │
         ▼                 ▼
      LOCAL            ONLINE AI
         │                 │
         └────────┬────────┘
                  ▼
          VERIFIED DATA/RAG
                  │
                  ▼
          STRUCTURED OUTPUT
```

---

# 💻 WebLLM

WebLLM can support local browser inference for appropriate tasks.

Potential use cases:

* Language detection
* Basic classification
* Normalization
* Lightweight AI assistance
* Cached civic information
* Offline preparation

Not every device will support large local models.

Therefore, graceful fallback is required.

---

# 📴 Offline Architecture

Offline mode should support:

* Drafting
* Voice recording
* Evidence capture
* Cached locality information
* Cached taxonomy
* Complaint preparation

When internet returns:

```text
Pending Sync
     ↓
Secure Upload
     ↓
Server Validation
     ↓
AI Processing
     ↓
Complaint Created
```

Never tell a citizen:

> "Complaint submitted"

until the server confirms it.

---

# 🏗️ System Architecture

```text
                     ┌────────────────────┐
                     │   CITIZEN PORTAL   │
                     │ Web / PWA / Mobile │
                     └─────────┬──────────┘
                               │
                     ┌─────────▼──────────┐
                     │    API GATEWAY     │
                     │ Auth / Rate Limits │
                     └─────────┬──────────┘
                               │
              ┌────────────────▼────────────────┐
              │         CORE PLATFORM           │
              │                                │
              │ Issues • Votes • Comments      │
              │ Tracking • Reports             │
              └───────┬──────────┬─────────────┘
                      │          │
              ┌───────▼───┐  ┌───▼────────────┐
              │ AI ENGINE │  │ CIVIC KNOWLEDGE│
              │           │  │ BASE           │
              │ NLP       │  │ Laws           │
              │ Duplicate │  │ Departments    │
              │ Priority  │  │ Officers       │
              │ Trust     │  │ Hubs           │
              └───────┬───┘  │ Documents      │
                      │      └────────────────┘
                      │
             ┌────────▼─────────┐
             │ GOVERNMENT       │
             │ DASHBOARD        │
             │                  │
             │ Queue            │
             │ Analytics        │
             │ GIS              │
             │ Reports          │
             │ Tracking         │
             └──────────────────┘
```

---

# 🗃️ Data Architecture

Core entities:

```text
User
Locality
PIN
Hub
Department
Officer
Issue
Report
Vote
Comment
Evidence
DuplicateLink
PriorityScore
TrustScore
Document
LegalReference
StatusEvent
Notification
AuditLog
```

---

# 🔐 Security

CivicChai must implement:

* Authentication
* Authorization
* RBAC
* MFA for administration
* Rate limiting
* Secure sessions
* Encryption
* Secure API access
* File validation
* Malware scanning
* Audit logging
* PII detection
* Prompt injection protection
* Abuse detection
* Vote manipulation detection

---

# 🔒 Privacy

The system should minimize exposure of personal information.

Public users should not automatically see:

* Phone numbers
* Private email
* Exact residential address
* Sensitive identity data

Government users should only receive information required for their authorized function.

---

# ⚖️ Compliance

CivicChai should maintain a compliance matrix covering, as applicable:

### DPDP Act 2023

Areas include:

* Notice
* Purpose limitation
* Data minimization
* Applicable processing basis
* Data principal rights
* Security safeguards
* Retention
* Grievance handling
* Breach response

### DPDP Rules 2025

Production implementation should account for applicable rules and commencement timelines.

### IT Rules 2021

Because CivicChai hosts:

* Posts
* Comments
* Images
* Videos
* Civic discussions

the platform should undergo an appropriate intermediary/content-governance assessment.

### CERT-In

Maintain:

* Incident response
* Logging
* Incident escalation
* Applicable reporting processes

### RPwD

Design for:

* Screen readers
* Keyboard access
* Captions
* Transcripts
* Accessible controls
* Voice interaction
* Clear contrast
* Non-color-only indicators

**Final production compliance must be reviewed by qualified Indian legal counsel and the relevant deployment authority.**

---

# 🤖 AI Governance

Every AI-generated decision should be traceable.

Store:

```text
Model
Version
Prompt / configuration where appropriate
Input reference
Output
Confidence
Timestamp
Decision
Human override
```

AI should recommend.

Authorized humans should retain responsibility for important administrative actions.

---

# 🚫 Anti-Spam & Anti-Manipulation

The platform should detect:

* Fake accounts
* Bot voting
* Mass voting
* Coordinated manipulation
* Duplicate spam
* Abusive comments
* Malicious uploads

Most importantly:

> **Raw votes must never be the only measure of civic priority.**

---

# ♿ Accessibility

CivicChai should support:

* WCAG-oriented design
* Keyboard navigation
* Screen readers
* Captions
* Voice input
* Keypad phones
* Large touch targets
* High contrast
* Simple language
* Multilingual support

---

# 🛠️ Recommended Technology Stack

A practical implementation can use:

### Frontend

* Next.js
* React
* TypeScript
* Tailwind CSS
* PWA
* Framer Motion

### Backend

* Node.js
* TypeScript
* REST/GraphQL APIs

### Database

* PostgreSQL
* PostGIS

### Search

* PostgreSQL full-text search
* pgvector / vector database

### AI

* WebLLM
* Online LLM API
* Embedding model
* Speech-to-text
* RAG pipeline

### Storage

* S3-compatible object storage

### Maps

* MapLibre / OpenStreetMap or an appropriate GIS provider

### Authentication

* OAuth / OTP / secure session authentication

### Voice

* Telephony provider
* IVR
* Speech recognition
* DTMF fallback

---

# 🔌 API Architecture

Example:

### Create complaint

```http
POST /api/issues
```

```json
{
  "input_type": "voice",
  "language": "mr",
  "text": "Station road var khup motha khadda aahe",
  "pincode": "401208",
  "location": {
    "lat": 19.123,
    "lng": 72.123
  }
}
```

---

### Duplicate search

```http
POST /api/issues/duplicate-check
```

Response:

```json
{
  "duplicate_found": true,
  "similarity": 0.93,
  "existing_issue_id": "CC-401208-2026-0001201"
}
```

---

### Support issue

```http
POST /api/issues/:id/support
```

---

### Track complaint

```http
GET /api/issues/:id
```

---

# 🧪 Example End-to-End Flow

## Citizen

Citizen says:

> "Station Road ki streetlight 15 din se band hai."

### Step 1 — AI

```text
Language: Hinglish
Category: Public Lighting
Issue: Streetlight outage
Location: Station Road
PIN: 401208
```

### Step 2 — Duplicate engine

Finds:

```text
Existing Issue

Station Road Streetlights

Similarity: 93%
```

### Step 3 — Citizen

Chooses:

> 🔥 Support Existing Issue

### Step 4 — Community

```text
Reports: 52
Supporters: 1,842
Chai Heat: 92°
```

### Step 5 — Government

Dashboard shows:

```text
#1 Local Civic Issue

Streetlight outage

Priority: 88
Chai Heat: 92

Department:
Public Lighting

PIN:
401208

Status:
Assigned
```

### Step 6 — Action

Officer updates:

> In Progress

### Step 7 — Resolution

Authority uploads resolution evidence.

### Step 8 — Citizen

Citizen verifies:

> **☕ Chai Served / Issue Resolved**

---

# 📊 Government Dashboard Metrics

Dashboard should display:

### Overview

```text
Total Issues
Critical Issues
High Priority
Unassigned
In Progress
Overdue
Resolved
Duplicate Reduction
```

### Department

```text
Roads
Water
Waste
Lighting
Drainage
Traffic
Public Health
Other
```

### Geographic

```text
State
District
Municipality
Ward
PIN
Locality
```

### Temporal

```text
Today
7 Days
30 Days
3 Months
Custom
```

---

# 🗄️ Database Schema

Simplified model:

```text
users
 ├── id
 ├── name
 ├── phone
 ├── email
 ├── language
 └── locality_id

localities
 ├── id
 ├── name
 ├── pincode
 ├── ward
 └── authority_id

issues
 ├── id
 ├── document_id
 ├── title
 ├── description
 ├── category
 ├── department_id
 ├── locality_id
 ├── priority
 ├── trust_score
 ├── chai_heat
 ├── status
 └── created_at

reports
 ├── id
 ├── issue_id
 ├── user_id
 ├── evidence_id
 └── created_at

votes
 ├── id
 ├── issue_id
 ├── user_id
 └── created_at

comments
 ├── id
 ├── issue_id
 ├── user_id
 └── content

documents
 ├── id
 ├── issue_id
 ├── title
 ├── source
 ├── version
 └── verified_at

status_events
 ├── id
 ├── issue_id
 ├── old_status
 ├── new_status
 ├── actor
 └── timestamp
```

---

# 📁 Project Structure

Recommended:

```text
civicchai/
│
├── apps/
│   ├── citizen/
│   └── government/
│
├── components/
│   ├── chai-card/
│   ├── complaint-card/
│   ├── chai-heat/
│   ├── timeline/
│   ├── report/
│   ├── duplicate/
│   └── maps/
│
├── backend/
│   ├── auth/
│   ├── issues/
│   ├── users/
│   ├── departments/
│   ├── officers/
│   ├── hubs/
│   ├── documents/
│   └── analytics/
│
├── ai/
│   ├── classification/
│   ├── duplicate/
│   ├── priority/
│   ├── trust/
│   ├── embeddings/
│   ├── rag/
│   └── webllm/
│
├── database/
│   ├── schema/
│   ├── migrations/
│   └── seeds/
│
├── telephony/
│   ├── ivr/
│   ├── voice/
│   └── dtmf/
│
├── docs/
│   ├── architecture/
│   ├── compliance/
│   └── api/
│
└── README.md
```

---

# 🏁 MVP

For the hackathon, focus on the following.

## Must Have

### Citizen

* Local Chai
* Complaint filing
* Voice/text
* Multilingual AI
* Classification
* Duplicate detection
* Support existing issue
* Chai Heat
* Complaint report
* Tracking

### Government

* Dashboard
* Complaint queue
* Department filtering
* Priority
* Chai Heat
* Issue details
* Status updates
* Basic analytics

---

# 🔮 Future Roadmap

## Phase 1

Citizen Portal

## Phase 2

AI Classification

## Phase 3

Duplicate Detection

## Phase 4

Government Dashboard

## Phase 5

GIS

## Phase 6

Keypad Phone Agent

## Phase 7

WebLLM / Offline

## Phase 8

Government integrations

## Phase 9

Nationwide locality network

---

# 🧪 Testing

Test:

### AI

* Multilingual classification
* Code mixing
* Duplicate detection
* False positives
* False negatives

### Voice

* Accent variations
* Background noise
* Multiple languages
* DTMF fallback

### Platform

* Mobile
* Desktop
* Slow network
* Offline mode

### Security

* Authentication
* Authorization
* Upload attacks
* Prompt injection
* Vote manipulation

### Accessibility

* Keyboard
* Screen reader
* Contrast
* Voice
* Touch targets

---

# 📈 KPIs

CivicChai should measure:

### AI

* Classification accuracy
* F1 score
* Duplicate precision
* Duplicate recall
* Language accuracy

### Government

* Assignment time
* Acknowledgement time
* Resolution time
* Overdue rate

### Community

* Support rate
* Independent corroboration
* Chai Heat growth
* Comment engagement

### Platform

* Complaint completion rate
* Voice completion rate
* Keypad completion rate
* Offline completion rate

---

# 🚀 Deployment

Recommended production architecture:

```text
                    USERS
                      │
              ┌───────┴───────┐
              ▼               ▼
          WEB/PWA           PHONE
              │               │
              └───────┬───────┘
                      ▼
                 CDN / WAF
                      │
                 API Gateway
                      │
              ┌───────┴────────┐
              ▼                ▼
          App Servers       AI Services
              │                │
              └───────┬────────┘
                      ▼
                  PostgreSQL
                      │
              ┌───────┴───────┐
              ▼               ▼
           PostGIS          Storage
```

Use:

* HTTPS
* Secure secrets
* Environment variables
* Automated backups
* Monitoring
* Error tracking
* Logging
* Database migrations
* CI/CD

---

# 🤝 Contribution Guidelines

Contributors should:

1. Create a feature branch.
2. Follow TypeScript standards.
3. Add tests for important logic.
4. Never commit API keys.
5. Never commit personal citizen data.
6. Document API changes.
7. Document AI model changes.
8. Follow accessibility standards.
9. Review privacy implications before adding data collection.
10. Submit a pull request.

---

# ⚠️ Important Product Principles

### 1. Never reject solely because AI says duplicate.

### 2. Never expose private citizen information unnecessarily.

### 3. Never invent government officers or laws.

### 4. Never use Trust Score as citizen reputation.

### 5. Never make Chai Heat equal to Priority.

### 6. Never claim an offline complaint was submitted until synchronized.

### 7. Never allow raw upvotes to determine government priority.

### 8. Always preserve the original citizen complaint.

### 9. AI should assist, not silently make irreversible administrative decisions.

### 10. Government information must be source-controlled and versioned.

---

# 🎯 CivicChai's Competitive Advantage

The strongest differentiation is not:

> **"We use AI."**

It is:

> **"We convert fragmented citizen complaints into community-supported, AI-structured civic issues."**

Traditional system:

```text
100 citizens
     ↓
100 complaints
     ↓
100 tickets
```

CivicChai:

```text
100 citizens
     ↓
AI similarity detection
     ↓
1 underlying issue
     ↓
100 supporting reports
     ↓
Community discussion
     ↓
High Chai Heat
     ↓
High civic priority
     ↓
Correct department
     ↓
Action
```

---

# 🏆 PS2 Alignment

CivicChai directly addresses the major technical requirements through:

| Requirement             | CivicChai |
| ----------------------- | --------- |
| Complaint intake        | ✅         |
| Multilingual input      | ✅         |
| Voice input             | ✅         |
| NLP                     | ✅         |
| Classification          | ✅         |
| Department mapping      | ✅         |
| Priority                | ✅         |
| Semantic similarity     | ✅         |
| Duplicate detection     | ✅         |
| Complaint clustering    | ✅         |
| Geographic intelligence | ✅         |
| GIS hotspots            | ✅         |
| Tracking                | ✅         |
| Analytics               | ✅         |
| Citizen participation   | 🔥        |
| Keypad accessibility    | 🔥        |
| Civic education         | 🔥        |
| Hybrid/local AI         | 🔥        |

---

# ☕ The CivicChai Experience

The complete experience can be summarized as:

```text
                 🇮🇳 INDIA
                    │
                    ▼
              LOCAL CHARCHA
                    │
                    ▼
                  ☕ CHAI
                    │
                    ▼
              AI UNDERSTANDS
                    │
                    ▼
           DUPLICATE CHECK
              /         \
            YES          NO
             │            │
             ▼            ▼
          SUPPORT       CREATE
             │            │
             └──────┬─────┘
                    ▼
             COMMUNITY VOTES
                    │
                    ▼
              🔥 CHAI HEAT
                    │
                    ▼
             PRIORITY ENGINE
                    │
                    ▼
             GOVERNMENT
                    │
                    ▼
                 ACTION
                    │
                    ▼
              RESOLUTION
                    │
                    ▼
               CHARCHA
                VERIFIED
```

---

# 🌏 Vision

CivicChai's long-term vision is to become a **digital civic layer for India**.

Not just a place where citizens complain.

Not just another government portal.

Not just another social network.

But a platform where:

> **Citizens discuss.**

> **AI understands.**

> **Communities prioritize.**

> **Authorities act.**

> **Everyone can track the outcome.**

---

# 🫖 Final Brand Statement

## **CIVICCHAI**

### **India mein har ek Charcha Chai Pe hoti hai.**

**Report it.**

**Discuss it.**

**Support it.**

**Heat it up.**

**Track it.**

**Resolve it.**

### ☕ **Charcha se Chai. Chai se Change.**

---

> **Project Status:** Concept / Hackathon Prototype
> **Target:** PS2
> **Primary Users:** Citizens + Government Administrators
> **Primary Channels:** Web + PWA + Voice + Keypad Phone
> **Core Technologies:** NLP + Semantic Search + WebLLM + Online AI + GIS + Analytics
> **Core Differentiator:** Community-powered duplicate consolidation and **Chai Heat-based civic prioritization**.
