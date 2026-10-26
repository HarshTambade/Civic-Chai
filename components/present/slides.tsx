import type { ReactNode } from 'react'
import { Big, HeatCup, Kicker, Line, Slide, Source } from './slide-kit'

export type DeckSlide = { id: string; title: string; render: () => ReactNode }

// One idea per slide, mostly in the SOP's own words. The cup in the corner heats up
// from slide to slide: "How hot is the Chai?"

export const SLIDES: DeckSlide[] = [
  {
    id: 'cover',
    title: 'Every complaint is a cup of chai',
    render: () => (
      <Slide tone="dark" cup={false} className="items-center text-center">
        <HeatCup heat={92} size={120} showLabel={false} />
        <h1 className="mt-8 font-display text-[110px] font-extrabold leading-none tracking-tight">CivicChai</h1>
        <p className="mt-6 font-display text-[40px] font-bold text-gold">Every complaint is a cup of chai.</p>
        <p className="mt-4 text-[24px] text-cream/70">Charcha se Chai. Chai se Change.</p>
      </Slide>
    ),
  },
  {
    id: 'tapri',
    title: 'The tapri',
    render: () => (
      <Slide>
        <Kicker>The insight</Kicker>
        <Big>“India mein har ek charcha<br />chai pe hoti hai.”</Big>
        <Line>The broken streetlight, the overflowing drain, the pothole near the school. Every neighbourhood already talks about it at the tapri.</Line>
        <p className="mt-8 font-display text-[40px] font-extrabold text-terracotta">But the charcha never reaches the office that can fix it.</p>
      </Slide>
    ),
  },
  {
    id: 'volume',
    title: '26.45 lakh',
    render: () => (
      <Slide>
        <p className="font-display text-[190px] font-extrabold leading-none tracking-tight text-terracotta">26.45 lakh</p>
        <Line className="text-[34px] opacity-90">grievances redressed in one year on India&apos;s national portal alone.</Line>
        <Line>Local civic problems are scattered across 4,700+ city bodies, helplines, WhatsApp groups and social media posts. The same streetlight gets reported dozens of times, and nobody knows who&apos;s on it.</Line>
        <Source>Lok Sabha reply, Apr 2025, via PTI (CPGRAMS 2024); TCPD, Ashoka University (4,765 urban local bodies).</Source>
      </Slide>
    ),
  },
  {
    id: 'cost',
    title: '2,385 lives',
    render: () => (
      <Slide tone="ink">
        <p className="font-display text-[190px] font-extrabold leading-none tracking-tight text-heat">2,385</p>
        <Line className="text-[34px] opacity-90">people died in pothole-related crashes in India in 2024.</Line>
        <Line>A complaint that sits unread is not just paperwork.</Line>
        <Source>MoRTH reply in Parliament on pothole-related deaths, 2020–2024.</Source>
      </Slide>
    ),
  },
  {
    id: 'idea',
    title: 'How hot is the chai?',
    render: () => (
      <Slide tone="dark">
        <Kicker className="text-gold">The idea</Kicker>
        <Big>How hot is the Chai?</Big>
        <Line className="text-cream/80">= How strongly does the community support the issue?</Line>
        <div className="mt-12 flex items-end gap-14">
          {[[20, 'Just poured'], [45, 'Warm'], [70, 'Hot'], [95, 'Very hot']].map(([heat, label]) => (
            <div key={label} className="flex flex-col items-center gap-4"><HeatCup heat={heat as number} size={110} /><span className="text-[22px] text-cream/75">{label}</span></div>
          ))}
        </div>
      </Slide>
    ),
  },
  {
    id: 'loop',
    title: 'How it works',
    render: () => (
      <Slide>
        <Kicker>How it works</Kicker>
        <Big>Speak. Chai. Fix.</Big>
        <div className="mt-12 flex items-center gap-5 whitespace-nowrap font-display text-[46px] font-extrabold">
          {['Speak', 'AI', 'Merge', 'Route', 'Heat', 'Fix'].map((step, index) => (
            <span key={step} className="flex items-center gap-5">
              <span className={index % 2 ? 'text-chai' : 'text-terracotta'}>{step}</span>
              {index < 5 && <span aria-hidden className="text-charcoal/25">→</span>}
            </span>
          ))}
        </div>
        <Line>Type it, say it, or call from any phone. AI finds the right department. The community adds heat. The authority acts, and the citizen confirms the fix.</Line>
      </Slide>
    ),
  },
  {
    id: 'duplicate',
    title: 'Arre, yeh chai pehle se chal rahi hai!',
    render: () => (
      <Slide>
        <Big className="text-[64px]">“Arre, yeh Chai pehle se<br />chal rahi hai!”</Big>
        <div className="mt-10 max-w-[720px] rounded-[28px] border-2 border-gold/60 bg-white p-8 shadow-sm">
          <p className="text-[20px] opacity-60">We found a similar complaint</p>
          <p className="mt-2 font-display text-[32px] font-extrabold">Station Road streetlights not working</p>
          <p className="mt-1 text-[20px] opacity-60">1,842 upvotes · 52 reports · Assigned</p>
          <div className="mt-6 flex gap-4 text-[22px] font-bold"><span className="rounded-2xl bg-heat px-6 py-3 text-cream">Support this issue</span><span className="rounded-2xl border-2 border-charcoal/15 px-6 py-3">This is a different problem</span></div>
        </div>
        <p className="mt-8 font-display text-[28px] font-extrabold text-terracotta">Never hard-block a citizen. 52 reports, one issue.</p>
      </Slide>
    ),
  },
  {
    id: 'call',
    title: 'No smartphone? Just call.',
    render: () => (
      <Slide tone="ink">
        <Kicker className="text-gold">For ~230 million keypad-phone users</Kicker>
        <Big>No smartphone? Just call.</Big>
        <div className="mt-10 space-y-4 text-[28px] leading-snug">
          <p><span className="text-gold">📞 CivicChai:</span> “Namaste. Aapki shikayat kis baare mein hai?”</p>
          <p><span className="text-cream/60">👤 Caller:</span> “15 din se Station Road ki lights band hain.”</p>
          <p><span className="text-gold">📞 CivicChai:</span> “PIN code? Proof hai? … Kya yeh sahi hai?”</p>
          <p><span className="text-cream/60">👤 Caller:</span> presses 1. <span className="text-gold">Report filed, ID read back.</span></p>
        </div>
        <Source>Counterpoint Research via Communications Today (230 million feature-phone users).</Source>
      </Slide>
    ),
  },
  {
    id: 'three-cups',
    title: 'Heat is not everything',
    render: () => (
      <Slide>
        <Kicker>Fair by design</Kicker>
        <Big>Three signals. Never one popularity contest.</Big>
        <div className="mt-12 grid grid-cols-3 gap-8">
          {[
            ['🔥 Chai Heat', 'How much the community cares'],
            ['⚠️ Priority', 'How urgent it is: safety, persistence, evidence'],
            ['🛡️ Trust', 'How good the proof is, never how “good” the citizen is'],
          ].map(([title, text]) => <div key={title}><p className="font-display text-[34px] font-extrabold">{title}</p><p className="mt-3 text-[22px] leading-snug opacity-70">{text}</p></div>)}
        </div>
        <p className="mt-12 font-display text-[28px] font-extrabold text-terracotta">A low-vote issue with high safety severity must never disappear.</p>
      </Slide>
    ),
  },
  {
    id: 'two-portals',
    title: 'Two portals',
    render: () => (
      <Slide tone="dark">
        <Kicker className="text-gold">Two portals, one chai</Kicker>
        <div className="mt-8 grid grid-cols-2 gap-16">
          <div>
            <p className="font-display text-[64px] font-extrabold leading-none">Citizens<br /><span className="text-gold">sip.</span></p>
            <p className="mt-6 text-[22px] leading-snug text-cream/75">Report by map, voice or call · join existing issues · track every step · confirm the fix · stay anonymous</p>
          </div>
          <div>
            <p className="font-display text-[64px] font-extrabold leading-none">Officials<br /><span className="text-gold">serve.</span></p>
            <p className="mt-6 text-[22px] leading-snug text-cream/75">One clean queue by ward and department · hotspots · response-time KPIs · verified officers and rules · full audit trail</p>
          </div>
        </div>
      </Slide>
    ),
  },
  {
    id: 'story',
    title: 'PIN 401208',
    render: () => (
      <Slide>
        <Kicker>A day in PIN 401208</Kicker>
        <ol className="mt-8 space-y-4 text-[30px] font-semibold leading-snug">
          {[
            ['10:02', 'Riya says “15 din se Station Road ki lights band hain”'],
            ['10:02', 'AI: Public Lighting. A similar issue exists, so she joins it.'],
            ['10:08', 'Department assigned. The chai is heating up.'],
            ['Day 3', '“Replaced 3 bulbs on poles 4–6.” Resolved.'],
            ['Day 3', 'Riya taps Confirm. Community verified ✓'],
          ].map(([time, text]) => <li key={time + text} className="flex gap-8"><span className="w-28 shrink-0 font-mono text-terracotta">{time}</span><span>{text}</span></li>)}
        </ol>
        <p className="mt-10 text-[18px] opacity-50">Illustrative walkthrough of the pilot scenario from the CivicChai SOP.</p>
      </Slide>
    ),
  },
  {
    id: 'why-now',
    title: 'Why now',
    render: () => (
      <Slide>
        <Kicker>Why now</Kicker>
        <div className="mt-10 grid grid-cols-3 gap-10">
          {[['1.03 bn', 'internet subscribers', 'text-terracotta'], ['600 mn', 'city dwellers by 2036', 'text-chai'], ['DPDP', 'privacy is now law', 'text-leaf']].map(([value, label, color]) => (
            <div key={label}><p className={`font-display text-[88px] font-extrabold leading-none ${color}`}>{value}</p><p className="mt-4 text-[26px] font-semibold opacity-75">{label}</p></div>
          ))}
        </div>
        <Line className="mt-14">The people are online, the cities are growing, and the law now demands privacy by design. CivicChai is built that way from day one.</Line>
        <Source>TRAI, Dec 2025; World Bank urbanisation estimates; Digital Personal Data Protection Act, 2023 and Rules, 2025.</Source>
      </Slide>
    ),
  },
  {
    id: 'ask',
    title: 'Pour the first chai',
    render: () => (
      <Slide tone="dark" cup={false} className="items-center text-center">
        <p className="font-display text-[30px] font-bold text-gold">Charcha → Chai → Heat → AI → Action → Track</p>
        <h2 className="mt-8 font-display text-[88px] font-extrabold leading-[1.02] tracking-tight">One ward. 90 days.<br />Let&apos;s pour the first chai.</h2>
        <p className="mt-10 text-[24px] text-cream/75">It&apos;s live and working: <b>civic-chai.vercel.app</b></p>
        <div className="mt-8"><HeatCup heat={95} size={64} showLabel={false} /></div>
      </Slide>
    ),
  },
]
