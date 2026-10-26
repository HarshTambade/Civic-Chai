import type { ReactNode } from 'react'
import { Bullets, Card, Kicker, Lead, Slide, Sources, Stat, Title } from './slide-kit'

export type DeckSlide = { id: string; title: string; render: () => ReactNode }

function Flow({ steps, dark = false }: { steps: string[]; dark?: boolean }) {
  return (
    <ol className="mt-8 grid grid-cols-6 gap-3">
      {steps.map((step, index) => (
        <li key={step} className={`relative rounded-[18px] border p-4 ${dark ? 'border-white/15 bg-white/10' : 'border-chai/15 bg-white/70'}`}>
          <span className="flex h-8 w-8 items-center justify-center rounded-full bg-terracotta text-[15px] font-bold text-cream">{index + 1}</span>
          <p className="mt-3 text-[16px] font-semibold leading-snug">{step}</p>
        </li>
      ))}
    </ol>
  )
}

function Table({ head, rows }: { head: string[]; rows: string[][] }) {
  return (
    <table className="mt-6 w-full border-separate border-spacing-0 overflow-hidden rounded-[18px] border border-chai/15 text-left text-[16px]">
      <thead className="bg-chai text-cream"><tr>{head.map((cell) => <th key={cell} className="px-4 py-3 font-semibold">{cell}</th>)}</tr></thead>
      <tbody>{rows.map((row, index) => <tr key={index} className={index % 2 ? 'bg-white/50' : 'bg-white/80'}>{row.map((cell, cellIndex) => <td key={cellIndex} className={`px-4 py-2.5 ${cellIndex === 0 ? 'font-semibold' : ''}`}>{cell}</td>)}</tr>)}</tbody>
    </table>
  )
}

export const SLIDES: DeckSlide[] = [
  {
    id: 'cover',
    title: 'CivicChai',
    render: () => (
      <Slide tone="dark" className="justify-center">
        <Kicker className="text-gold">PS2 · AI-based citizen grievance classification, prioritisation &amp; duplicate detection</Kicker>
        <h1 className="mt-6 font-display text-[104px] font-extrabold leading-none tracking-tight">CivicChai</h1>
        <p className="mt-5 font-display text-[40px] font-bold text-gold">Charcha se Chai. Chai se Change.</p>
        <p className="mt-8 max-w-[860px] text-[24px] leading-[1.5] text-cream/80">An AI-powered civic grievance platform with a community layer. Citizens report in their own language, by app, voice or a keypad phone. AI classifies, de-duplicates and prioritises. Authorities get a clean, routed, trackable queue.</p>
        <p className="absolute bottom-[56px] left-[72px] text-[17px] text-cream/60">Two portals · one shared backend · built for a controlled pilot</p>
      </Slide>
    ),
  },
  {
    id: 'insight',
    title: 'The insight',
    render: () => (
      <Slide>
        <Kicker>The insight</Kicker>
        <Title>“India mein har ek charcha chai pe hoti hai.”</Title>
        <Lead>Every neighbourhood already discusses its broken streetlight or overflowing drain at the chai tapri. The problem is that the conversation never reaches the office that can fix it.</Lead>
        <div className="mt-10 grid grid-cols-3 gap-5">
          <Card title="Every complaint is a cup of chai">A local problem becomes a public <b>Charcha</b> (discussion) that neighbours can see, join and track.</Card>
          <Card title="How hot is the chai?">Community support raises its <b>Chai Heat</b>, a visible signal of how many people care.</Card>
          <Card title="Heat is not the only signal">Authorities rank work by <b>civic priority</b>: severity, persistence and evidence, not by popularity alone.</Card>
        </div>
      </Slide>
    ),
  },
  {
    id: 'problem',
    title: 'The problem',
    render: () => (
      <Slide>
        <Kicker>The problem</Kicker>
        <Title>Grievances are growing faster than the systems that handle them</Title>
        <div className="mt-8 grid grid-cols-3 gap-5">
          <Stat value="26.45 lakh" label="grievances redressed on the national CPGRAMS portal in 2024" note="Up from about 3 lakh a year in 2014, and only for central ministries" />
          <Stat value="4,700+" label="urban local bodies, each with its own helplines, apps and offices" note="Local civic complaints are spread across all of them" tone="text-chai" />
          <Stat value="2,385" label="deaths in pothole-related crashes in 2024" note="9,438 deaths over 2020–2024" tone="text-heat" />
        </div>
        <div className="mt-6 grid grid-cols-3 gap-5 text-[17px] leading-[1.5]">
          <p><b>Fragmented:</b> the same streetlight is reported dozens of times, on social media, helplines and WhatsApp, with no shared record.</p>
          <p><b>Opaque:</b> citizens don&apos;t know which department or officer is responsible, or what happens next.</p>
          <p><b>Low trust:</b> where complaint apps don&apos;t close the loop, residents give up on them.</p>
        </div>
        <Sources>Lok Sabha written reply, Apr 2025 (via PTI); PIB/DARPG via Drishti IAS; TCPD, Ashoka University ULB dataset; MoRTH reply in Parliament on pothole-related deaths (2020–2024).</Sources>
      </Slide>
    ),
  },
  {
    id: 'why-now',
    title: 'Why now',
    render: () => (
      <Slide>
        <Kicker>Why now</Kicker>
        <Title>India is online, urbanising and regulating data</Title>
        <div className="mt-8 grid grid-cols-4 gap-4">
          <Stat value="1.03 bn" label="internet subscribers" note="TRAI, December 2025" />
          <Stat value="~230 mn" label="people still on feature phones" note="Voice and keypad access is essential" tone="text-chai" />
          <Stat value="~600 mn" label="urban residents expected by 2036" note="About 40% of India" tone="text-leaf" />
          <Stat value="100" label="Smart Cities running command &amp; control centres" note="Ready destinations for civic data" tone="text-heat" />
        </div>
        <Card className="mt-6" title="Privacy is now law">The Digital Personal Data Protection Act, 2023 and the DPDP Rules notified in November 2025 make privacy-by-design, consent and data-rights workflows mandatory, not optional. CivicChai is built that way from day one.</Card>
        <Sources>TRAI Press Release No. 32 of 2026; Counterpoint Research via Communications Today; World Bank urbanisation estimates; MoHUA / Smart Cities Mission replies (2025); MeitY DPDP Rules 2025.</Sources>
      </Slide>
    ),
  },
  {
    id: 'left-out',
    title: 'Who gets left out',
    render: () => (
      <Slide>
        <Kicker>Who gets left out today</Kicker>
        <Title>Forms assume English, a smartphone and knowing the right department</Title>
        <div className="mt-8 grid grid-cols-2 gap-6">
          <div className="space-y-4">
            <Stat value="52.8 crore" label="people with Hindi as first language" note="Census 2011" />
            <Stat value="8.3 crore" label="Marathi speakers, and 22 scheduled languages in all" note="Census 2011 / Eighth Schedule" tone="text-chai" />
          </div>
          <div>
            <p className="font-display text-[24px] font-bold">CivicChai design principles</p>
            <Bullets className="mt-4" items={[
              'Speak or type in Hindi, Marathi, English or code-mixed Hinglish.',
              'Call from any keypad phone: a guided voice line with keypad fallback.',
              'No form fields to guess: AI suggests the category and department, and the citizen confirms.',
              'Works offline: drafts are saved and filed when the connection returns.',
              'Anonymous public identity, so people can speak up safely.',
            ]} />
          </div>
        </div>
        <Sources>Census of India 2011 language data; Constitution of India, Eighth Schedule.</Sources>
      </Slide>
    ),
  },
  {
    id: 'solution',
    title: 'The solution',
    render: () => (
      <Slide tone="dark">
        <Kicker className="text-gold">The solution</Kicker>
        <Title>One loop from a citizen&apos;s voice to a verified fix</Title>
        <Lead className="text-cream/80">CivicChai turns informal complaints into structured, routed, trackable civic records, and keeps the community in the loop until the work is confirmed.</Lead>
        <Flow dark steps={['Speak, type or call', 'AI understands & classifies', 'Similar issue? Join it or file new', 'Structured report + routing', 'Community adds heat & proof', 'Authority acts; citizen verifies']} />
        <p className="mt-8 text-[18px] text-cream/70">Never hard-blocks a citizen: AI suggests, people decide, and every staff action is audited.</p>
      </Slide>
    ),
  },
  {
    id: 'two-portals',
    title: 'Two portals',
    render: () => (
      <Slide>
        <Kicker>Product architecture</Kicker>
        <Title>Two portals, one shared backend</Title>
        <div className="mt-8 grid grid-cols-2 gap-6">
          <Card title="Citizen portal (web + installable app)" className="p-6">
            <Bullets className="mt-2 text-[17px]" items={['Local Chai: neighbourhood feed and community map', 'Pour a Chai: report with location, voice and proof', 'Chai Tapri: trending issues ranked by priority', 'My Charcha: tracking, notifications and verification', 'Profile: area, language, consent and data rights']} />
          </Card>
          <Card title="Government control room" className="p-6">
            <Bullets className="mt-2 text-[17px]" items={['Complaint queue by jurisdiction, department, priority and SLA', 'Issue detail: original text, AI analysis, evidence, duplicates', 'GIS hotspots and KPI analytics', 'Verified officer, hub and document registry; locality QR codes', 'Moderation, privacy requests and audit trail']} />
          </Card>
        </div>
        <p className="mt-6 text-[17px] opacity-70">Seven roles with least privilege: citizen, moderator, department operator, supervisor, authority admin, system admin and auditor. Every staff role uses two-factor sign-in.</p>
      </Slide>
    ),
  },
  {
    id: 'scenario',
    title: 'Scenario: a broken streetlight',
    render: () => (
      <Slide>
        <Kicker>Scenario · PIN 401208</Kicker>
        <Title>“15 din se Station Road ki lights band hain”</Title>
        <div className="mt-7 grid grid-cols-[1fr_1fr] gap-6">
          <ol className="space-y-2.5 text-[17px]">
            {[
              ['10:02', 'Riya opens CivicChai; the map finds her location and sets PIN 401208, Station Road'],
              ['10:02', 'She speaks in Hinglish and adds a photo'],
              ['10:02', 'AI: Public Lighting → Municipal Public Lighting, 82% confidence'],
              ['10:02', 'A similar issue exists, so she joins it; it now has 2 reports'],
              ['10:08', 'Supervisor assigns a verified officer'],
              ['13:20', 'Office acknowledges; status is public'],
              ['Day 3', 'Resolved: “Replaced 3 bulbs on poles 4–6”'],
              ['Day 3', 'Riya and neighbours confirm the fix: Community Verified'],
            ].map(([time, text]) => <li key={time + text} className="flex gap-4"><span className="w-16 shrink-0 font-mono font-bold text-terracotta">{time}</span><span>{text}</span></li>)}
          </ol>
          <div className="rounded-[22px] bg-chai p-6 text-cream">
            <p className="font-mono text-[14px] text-cream/60">CC-401208-2026-0001842</p>
            <p className="mt-2 font-display text-[28px] font-extrabold">Streetlight outage — Station Road</p>
            <div className="mt-5 grid grid-cols-2 gap-3 text-[16px]">
              {[['Department', 'Municipal Public Lighting'], ['Priority', 'High · 69/100'], ['Chai Heat', '26°, rising'], ['Reports', '2 independent'], ['Trust', 'Evidence attached'], ['Status', 'Community Verified']].map(([k, v]) => <div key={k} className="rounded-xl bg-white/10 p-3"><p className="text-[13px] uppercase tracking-wide text-cream/55">{k}</p><p className="mt-1 font-semibold">{v}</p></div>)}
            </div>
            <p className="mt-5 text-[14px] text-cream/60">Illustrative walkthrough of the pilot scenario.</p>
          </div>
        </div>
      </Slide>
    ),
  },
  {
    id: 'filing',
    title: 'Filing in under a minute',
    render: () => (
      <Slide>
        <Kicker>Citizen experience</Kicker>
        <Title>Filing feels like booking a ride, not filling a form</Title>
        <div className="mt-8 grid grid-cols-4 gap-4">
          <Card title="📍 Where?">The map detects your location like a ride-hailing app. Drag the pin; the PIN code and locality fill in from OpenStreetMap and India Post. Signed locality QR codes work too.</Card>
          <Card title="🎙️ What?">Speak or type in Hindi, Marathi or English. Live transcription, with no duplicated words.</Card>
          <Card title="📷 Proof">Add photos or video. Stored privately; only you and authorised staff can see them.</Card>
          <Card title="✅ Confirm">Review the AI&apos;s category and department, change them if wrong, then file. You get a document ID and an education card.</Card>
        </div>
        <div className="mt-6 grid grid-cols-3 gap-4 text-[17px]">
          <p><b>Anonymous by design:</b> others see “KadakKulhad-3F9A”, never your name or email.</p>
          <p><b>Offline ready:</b> installable app; drafts are kept on the device and filed later.</p>
          <p><b>Accessible:</b> keyboard and screen-reader friendly, haptic feedback, large tap targets.</p>
        </div>
      </Slide>
    ),
  },
  {
    id: 'ai',
    title: 'AI that understands',
    render: () => (
      <Slide tone="ink">
        <Kicker className="text-gold">AI layer</Kicker>
        <Title>Layered AI: private by default, cloud only with consent</Title>
        <div className="mt-8 grid grid-cols-[1.1fr_0.9fr] gap-6">
          <div className="rounded-[22px] border border-white/15 bg-white/5 p-6 font-mono text-[16px] leading-[1.7]">
            <p className="text-cream/55">input</p>
            <p className="text-gold">“15 din se Station Road ki lights band hain”</p>
            <p className="mt-3 text-cream/55">analysis</p>
            <p>language: Hinglish</p><p>category: Public Lighting → Streetlight outage</p><p>department: Municipal Public Lighting</p><p>severity: raised for 15 days persistence</p><p>confidence: 82% · model: civicchai-rules-v1</p>
          </div>
          <div className="space-y-4">
            <Card dark title="1 · On-device rules">Instant multilingual classification, with no data leaving the app.</Card>
            <Card dark title="2 · Optional online AI">Used only when the citizen ticks consent; output is limited to known categories.</Card>
            <Card dark title="3 · Never invents facts">Laws, officers and contacts come only from the authority&apos;s verified registry. AI suggests and officials decide.</Card>
          </div>
        </div>
      </Slide>
    ),
  },
  {
    id: 'duplicates',
    title: 'Duplicate engine',
    render: () => (
      <Slide>
        <Kicker>Duplicate engine</Kicker>
        <Title>“Arre, yeh Chai pehle se chal rahi hai!”</Title>
        <div className="mt-7 grid grid-cols-[0.9fr_1.1fr] gap-6">
          <div className="rounded-[22px] border border-gold/50 bg-gold/10 p-6">
            <p className="text-[16px] opacity-70">We found a similar complaint in PIN 401208</p>
            <p className="mt-2 font-display text-[24px] font-bold">Streetlights not working on Station Road</p>
            <p className="mt-1 text-[16px] opacity-70">52 reports · 1,842 supporters · Assigned · 91% strong match</p>
            <div className="mt-5 grid grid-cols-2 gap-3 text-center text-[16px] font-semibold"><span className="rounded-xl bg-heat px-3 py-3 text-cream">Support this issue</span><span className="rounded-xl border border-chai/30 bg-white px-3 py-3">This is different</span></div>
            <p className="mt-3 text-[13px] opacity-55">Illustrative example</p>
          </div>
          <div>
            <Table head={['Similarity', 'What happens']} rows={[['0.90 – 1.00', 'Strong suggestion, shown prominently'], ['0.75 – 0.89', 'Related suggestion; never auto-merged'], ['Below 0.75', 'Treated as a distinct issue']]} />
            <Bullets className="mt-5 text-[17px]" items={['Same wording in a different PIN is never merged.', 'Hard negatives stay apart: a pothole and a water leak at the same spot.', 'Joining adds the citizen’s own report as corroboration.', 'Staff merges are reversible and audited.']} />
          </div>
        </div>
      </Slide>
    ),
  },
  {
    id: 'scores',
    title: 'Priority vs trust',
    render: () => (
      <Slide>
        <Kicker>Scoring</Kicker>
        <Title>Three separate signals, never a citizen ranking</Title>
        <div className="mt-6 grid grid-cols-[1.15fr_0.85fr] gap-6">
          <Table head={['Civic priority factor', 'Weight']} rows={[['Severity / urgency', '25%'], ['Community support (adjusted for manipulation)', '25%'], ['Independent reports', '15%'], ['Persistence', '10%'], ['Geographic concentration', '10%'], ['Evidence quality', '10%'], ['Verified service-target context', '5%']]} />
          <div className="space-y-4">
            <Card title="🔥 Chai Heat">The community support signal: one vote per account, rate-limited, with spike detection.</Card>
            <Card title="⚠️ Priority">How urgent the work is. A severe, low-vote issue (an open manhole near a school) still rises to the top.</Card>
            <Card title="🛡️ Trust">Confidence in the report&apos;s evidence. It is never a judgement of the citizen, and never a reason to reject a report.</Card>
          </div>
        </div>
      </Slide>
    ),
  },
  {
    id: 'dashboard',
    title: 'Government control room',
    render: () => (
      <Slide tone="dark">
        <Kicker className="text-gold">For authorities</Kicker>
        <Title>A clean, routed queue instead of a noisy inbox</Title>
        <div className="mt-8 grid grid-cols-3 gap-4">
          <Card dark title="Segregation">State → district → ward → PIN · department → category · priority → trust → SLA age · source channel</Card>
          <Card dark title="KPIs that matter">Median time to acknowledge, assign and resolve; duplicate reduction; evidence-backed share; verified closures</Card>
          <Card dark title="Integrity signals">Sudden support spikes and heavy support without corroboration are flagged for human review</Card>
          <Card dark title="GIS hotspots">Heat, density, priority and resolution layers, generalised to about 1 km before leaving the server</Card>
          <Card dark title="Verified registry">Hubs, officers, documents and service targets, verifiable only from official .gov.in / .nic.in sources</Card>
          <Card dark title="Accountable actions">Resolution needs a public note or an official record; every action is written to the audit trail</Card>
        </div>
      </Slide>
    ),
  },
  {
    id: 'education',
    title: 'Civic education',
    render: () => (
      <Slide>
        <Kicker>Civic education layer</Kicker>
        <Title>Every report teaches the citizen what happens next</Title>
        <div className="mt-8 grid grid-cols-3 gap-4">
          {[['What is the problem?', 'Public Lighting · streetlight outage'], ['Who handles it?', 'Municipal Public Lighting (suggested route)'], ['Who is the official?', 'Only a published, verified officer role'], ['Where is the hub?', 'Verified ward office address and contact'], ['What rule applies?', 'Official document with source and version'], ['What happens next?', 'Acknowledge → assign → act → resolve → verify']].map(([q, a]) => <Card key={q} title={q}>{a}</Card>)}
        </div>
        <p className="mt-6 text-[17px] opacity-75">If there is no verified source, CivicChai says so instead of guessing. Legal information is educational, not legal advice.</p>
      </Slide>
    ),
  },
  {
    id: 'inclusion',
    title: 'Voice & keypad access',
    render: () => (
      <Slide>
        <Kicker>Inclusion</Kicker>
        <Title>No smartphone needed: a voice line with keypad fallback</Title>
        <Flow steps={['Call the CivicChai number; choose Hindi, Marathi or English', 'Consent to speech-to-text, or use keypad categories', 'Describe the problem; enter the PIN on the keypad', 'How long? Any proof? (press 1 / 2)', 'Hear the summary and your words read back; correct or confirm', 'Get the document ID by voice']} />
        <div className="mt-7 grid grid-cols-3 gap-4 text-[17px]">
          <p><b>Same record:</b> phone, web and app reports create the same structured issue.</p>
          <p><b>Safe by design:</b> transcripts are kept, raw audio is not, and every step has a keypad fallback.</p>
          <p><b>Signed:</b> the telephony webhook verifies every provider request.</p>
        </div>
      </Slide>
    ),
  },
  {
    id: 'safety',
    title: 'Trust, privacy & safety',
    render: () => (
      <Slide tone="ink">
        <Kicker className="text-gold">Trust, privacy &amp; safety</Kicker>
        <Title>Built for India&apos;s DPDP era</Title>
        <div className="mt-8 grid grid-cols-3 gap-4">
          <Card dark title="Anonymous citizens">Public handles only; phone numbers, emails, ID numbers and house numbers are redacted from public text.</Card>
          <Card dark title="Location privacy">Exact points are visible only to authorised staff; public maps show about 1 km.</Card>
          <Card dark title="Locked-down staff">Seven least-privilege roles, two-factor sign-in, row-level security in the database.</Card>
          <Card dark title="Fair moderation">Report, review with a written reason, and appeal. Good-faith criticism stays visible.</Card>
          <Card dark title="Data rights">Access, correction, erasure and grievance requests with a recorded outcome.</Card>
          <Card dark title="Tamper-evident">Signed QR codes, a signed IVR webhook, rate limits and a complete audit trail.</Card>
        </div>
      </Slide>
    ),
  },
  {
    id: 'scenarios',
    title: 'More scenarios',
    render: () => (
      <Slide>
        <Kicker>Scenarios</Kicker>
        <Title>How CivicChai behaves in real situations</Title>
        <div className="mt-7 grid grid-cols-2 gap-4">
          <Card title="Open manhole near a school after rain">Only 3 supporters, but safety words raise severity to the top of the queue. Priority, not popularity.</Card>
          <Card title="40 people report the same water leak">One canonical issue with 40 corroborating reports: 40 voices, one work order.</Card>
          <Card title="An elderly resident with a keypad phone">Calls the voice line in Marathi, presses keys for the PIN, hears the summary and gets an ID.</Card>
          <Card title="A comment shares someone's phone number">Automatically redacted; a moderator reviews, records a reason, and the reporter can appeal.</Card>
          <Card title="A fake QR sticker on a pole">The signature check fails, and the app warns: “This QR code could not be verified.”</Card>
          <Card title="A sudden vote surge on one issue">Flagged as a support spike for human review; scores are never silently changed.</Card>
        </div>
      </Slide>
    ),
  },
  {
    id: 'landscape',
    title: 'How it compares',
    render: () => (
      <Slide>
        <Kicker>Landscape</Kicker>
        <Title>Where existing channels typically fall short</Title>
        <Table head={['Capability', 'Social media posts', 'Phone helplines', 'Standalone complaint apps', 'CivicChai']} rows={[
          ['Structured, routed record', 'No', 'Sometimes', 'Yes', 'Yes, with a document ID'],
          ['Duplicate consolidation', 'No', 'No', 'Rarely', 'AI suggests; citizen and staff decide'],
          ['Community signal', 'Likes only', 'No', 'Rarely', 'Chai Heat + priority'],
          ['Local language voice + keypad', 'No', 'Voice only', 'Rarely', 'Yes'],
          ['Public tracking & citizen verification', 'No', 'No', 'Partly', 'Yes'],
          ['Privacy (anonymous, redacted)', 'No', 'n/a', 'Varies', 'By design'],
          ['Verified officer & rules info', 'No', 'No', 'Rarely', 'Source-linked registry'],
        ]} />
        <p className="mt-4 text-[14px] opacity-55">General comparison of channel types; individual products vary.</p>
      </Slide>
    ),
  },
  {
    id: 'market',
    title: 'Market & opportunity',
    render: () => (
      <Slide>
        <Kicker>Opportunity</Kicker>
        <Title>Every city needs this, and the infrastructure already exists</Title>
        <div className="mt-8 grid grid-cols-3 gap-5">
          <Stat value="4,700+" label="urban local bodies that receive civic complaints" tone="text-chai" />
          <Stat value="100" label="Smart Cities with operational command & control centres" note="7,741 projects worth ₹1.55 lakh crore completed by Dec 2025" />
          <Stat value="13 days" label="average CPGRAMS resolution in 2024, down from 28 in 2019" note="Proof that digital grievance systems improve outcomes" tone="text-leaf" />
        </div>
        <Lead className="text-[19px]">CivicChai can plug into existing command centres and grievance systems rather than replacing them: it adds multilingual intake, de-duplication, community signal and verification on top.</Lead>
        <Sources>TCPD Ashoka University; Rajya Sabha reply on Smart Cities Mission (Dec 2025); DARPG data via AIR News (Dec 2024).</Sources>
      </Slide>
    ),
  },
  {
    id: 'model',
    title: 'Business model',
    render: () => (
      <Slide>
        <Kicker>Business model · proposed, to validate in the pilot</Kicker>
        <Title>Free for citizens. A platform service for authorities.</Title>
        <div className="mt-8 grid grid-cols-3 gap-5">
          <Card title="Government platform subscription">Per urban local body or ward cluster, tiered by population: control room, analytics, registry and support.</Card>
          <Card title="Implementation & integration">Onboarding the verified registry, training nodal officers, and integrating with command centres and existing grievance portals.</Card>
          <Card title="Partnerships & CSR">Telephony and SMS for keypad reach, civic NGOs for assisted filing, and CSR funding for under-served wards.</Card>
        </div>
        <Card className="mt-5" title="Low running cost by design">Rules-first, on-device AI means most complaints never call a paid model; online AI is optional and consent-based.</Card>
      </Slide>
    ),
  },
  {
    id: 'kpis',
    title: 'Pilot success metrics',
    render: () => (
      <Slide tone="dark">
        <Kicker className="text-gold">Measuring impact</Kicker>
        <Title>What the pilot will prove</Title>
        <div className="mt-8 grid grid-cols-4 gap-4">
          {['Duplicate suggestion precision', 'Duplicate reduction', 'Classification accuracy by language', 'Routing accuracy', 'Median time to acknowledgement', 'Median time to resolution', 'Evidence-backed issue rate', 'Community-verified closures'].map((metric) => <Card dark key={metric} title={metric}>Baseline in week 1, target agreed with the pilot authority</Card>)}
        </div>
        <p className="mt-6 text-[17px] text-cream/70">The control room&apos;s Analytics view already computes these from live data.</p>
      </Slide>
    ),
  },
  {
    id: 'built',
    title: 'Built today',
    render: () => (
      <Slide>
        <Kicker>Traction · what is built</Kicker>
        <Title>A working product, not a mock-up</Title>
        <div className="mt-7 grid grid-cols-2 gap-6">
          <Bullets items={['Citizen portal and installable app, live at civic-chai.vercel.app', 'Ride-hailing style location with PIN lookup and signed locality QR codes', 'Multilingual voice, keypad voice line (IVR) and offline drafts', 'AI classification, duplicate engine, Chai Heat, priority and trust', 'Government control room for 7 roles with two-factor sign-in', 'KPI analytics, GIS heatmap, verified registry, moderation and audit']} />
          <div className="space-y-4">
            <Card title="Stack">Next.js 16 · React 19 · Supabase Postgres with row-level security · Leaflet + OpenStreetMap · Web Speech · Twilio IVR · optional WebLLM and Groq</Card>
            <Card title="Quality">Automated tests for classification, scoring, duplicates, redaction, QR signing, analytics and speech; versioned database migrations</Card>
            <Card title="Next">SMS/USSD document IDs · semantic (embedding) duplicate search · RAG over verified documents · upload malware scanning</Card>
          </div>
        </div>
      </Slide>
    ),
  },
  {
    id: 'roadmap',
    title: 'Roadmap & ask',
    render: () => (
      <Slide>
        <Kicker>Roadmap &amp; the ask</Kicker>
        <Title>A 90-day pilot in one PIN code</Title>
        <div className="mt-7 grid grid-cols-3 gap-4">
          <Card title="Days 0–30 · Set up">Verify the registry (hubs, officers, documents), onboard nodal officers, publish the privacy notice, place locality QR codes.</Card>
          <Card title="Days 31–60 · Run">Open citizen intake and the voice line; weekly duplicate and routing reviews; moderation coverage.</Card>
          <Card title="Days 61–90 · Measure">KPI report on acknowledgement and resolution times, duplicate reduction and citizen verification; go/no-go to scale.</Card>
        </div>
        <div className="mt-6 rounded-[22px] bg-chai p-6 text-cream">
          <p className="font-display text-[24px] font-bold">What we need from a partner authority</p>
          <p className="mt-2 text-[18px] text-cream/80">One ward or PIN code · nodal officers per department · verified office and officer data · a telephony number · legal and privacy review</p>
        </div>
      </Slide>
    ),
  },
  {
    id: 'close',
    title: 'Thank you',
    render: () => (
      <Slide tone="dark" className="items-center justify-center text-center">
        <p className="font-display text-[34px] font-bold text-gold">Charcha se Chai. Chai se Change.</p>
        <h2 className="mt-6 font-display text-[64px] font-extrabold leading-tight">Every local problem deserves<br />a hot cup of chai.</h2>
        <p className="mt-8 text-[22px] text-cream/75">Try it: <b>civic-chai.vercel.app</b> · tap “Pour a Chai”</p>
      </Slide>
    ),
  },
  {
    id: 'sources',
    title: 'Sources',
    render: () => (
      <Slide>
        <Kicker>Sources</Kicker>
        <Title className="text-[36px]">Research behind the numbers</Title>
        <ol className="mt-5 grid grid-cols-2 gap-x-8 gap-y-2.5 text-[14px] leading-snug">
          {[
            ['CPGRAMS 2024: 26,45,869 grievances redressed (90.5%)', 'theweek.in/wire-updates/national/2025/04/02/des19-lsq-grievances.html'],
            ['Average resolution 28 days (2019) → 13 days (2024)', 'newsonair.gov.in · CPGRAMS Jan 2020–Oct 2024'],
            ['Grievances ~3 lakh (2014) → ~27 lakh (2024)', 'drishtiias.com (PIB/DARPG summary)'],
            ['1,028.61 million internet subscribers, Dec 2025', 'trai.gov.in · Press Release No. 32 of 2026'],
            ['~230 million feature phone users', 'Counterpoint Research via communicationstoday.co.in'],
            ['~600 million urban residents by 2036 (~40%)', 'World Bank estimates; NCP technical group (594 mn)'],
            ['Pothole-related deaths: 2,385 (2024); 9,438 (2020–24)', 'MoRTH reply in Parliament, reported by siasat.com'],
            ['4,61,312 road accidents and 1,68,491 deaths in 2022', 'MoRTH, Road Accidents in India 2022'],
            ['4,765 urban local bodies', 'tcpd.ashoka.edu.in'],
            ['Hindi 52.8 crore and Marathi 8.3 crore speakers; 22 scheduled languages', 'Census of India 2011'],
            ['100 Smart Cities with ICCCs; 7,741 projects (₹1,55,386 crore)', 'Rajya Sabha reply, Dec 2025; MoHUA'],
            ['DPDP Act 2023; DPDP Rules notified 14 Nov 2025', 'meity.gov.in'],
          ].map(([fact, source]) => <li key={fact}><p className="font-semibold">{fact}</p><p className="opacity-60">{source}</p></li>)}
        </ol>
        <p className="mt-4 text-[13px] opacity-55">Figures are as reported by the cited sources; some secondary reports differ slightly. Product screens and example numbers in scenarios are illustrative.</p>
      </Slide>
    ),
  },
]
