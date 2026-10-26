import type { Metadata } from 'next'
import Link from 'next/link'
import { LegalPage } from '@/components/legal/legal-page'
import { PRIVACY_NOTICE_VERSION, legalContacts } from '@/lib/legal'
import { pageMetadata } from '@/lib/seo'

export const metadata: Metadata = pageMetadata({ title: 'Privacy notice', description: 'What CivicChai collects, why, who processes it and how to exercise your data rights.', path: '/privacy' })

export default function PrivacyPage() {
  const contacts = legalContacts()
  return (
    <LegalPage eyebrow="Privacy notice" title="How CivicChai uses your information" intro="CivicChai collects only what it needs to file, route, track and secure civic complaints. This notice is written for the Digital Personal Data Protection Act, 2023 and must be reviewed by the deploying authority's counsel before a public pilot.">
      <section><h2>Who is responsible</h2>
        <ul><li>Platform operator: {contacts.operator}</li><li>Grievance officer: {contacts.grievanceOfficer}{contacts.grievanceEmail ? ` · ${contacts.grievanceEmail}` : ''}</li><li>Notice version: {PRIVACY_NOTICE_VERSION}</li></ul>
      </section>
      <section><h2>What we collect and why</h2>
        <ul>
          <li><b>Account:</b> email and password (handled by Supabase Auth) so you can track reports. You are shown publicly only as an anonymous name such as KadakKulhad-3F9A. No real name is required.</li>
          <li><b>Your report:</b> the text you type or dictate, category, PIN code and locality, used to route the issue to a department. The public page shows a redacted version; phone numbers, emails, identity numbers and house numbers are hidden.</li>
          <li><b>Location (optional):</b> if you tap “Use my current location”, your browser shares your coordinates. They are sent once to OpenStreetMap Nominatim to suggest the PIN and locality. If you attach them to a report, only authorized staff see the exact point; public maps show an area of about 1 km.</li>
          <li><b>Photos and videos (optional):</b> stored privately and visible only to you and authorized staff for the issue.</li>
          <li><b>Voice:</b> the browser converts speech to text on your device or through your browser's speech service. CivicChai does not keep audio. Phone calls (if enabled) keep the transcript, not the recording.</li>
          <li><b>Participation:</b> supports, follows and comments, to calculate community signals (Chai Heat) and notify you of updates.</li>
          <li><b>Security records:</b> audit logs of staff actions and limited request data for rate limiting and abuse prevention.</li>
        </ul>
      </section>
      <section><h2>Optional processing you control</h2>
        <ul><li>Online AI classification: your complaint text is sent to the configured AI provider only when you tick the online AI option.</li><li>Offline drafts: kept in this browser only when you allow it, and removed after they are filed.</li><li>Location: shared only when you ask the app to locate you.</li></ul>
      </section>
      <section><h2>Service providers</h2>
        <ul><li>Supabase (database, authentication, private file storage)</li><li>Vercel (hosting)</li><li>OpenStreetMap Nominatim and the India Post PIN lookup (address and PIN suggestions)</li><li>Groq (optional AI classification, only with your consent)</li><li>Twilio (phone line, if the authority enables it)</li></ul>
      </section>
      <section><h2>Your rights</h2>
        <p>You can ask to access, correct or erase your data, or raise a privacy grievance, from <Link href="/citizen" className="font-semibold text-chai underline">Profile → Privacy &amp; data rights</Link>. Requests are reviewed by a person and the outcome is recorded. Some records may need to be retained where the responsible authority is required to keep them.</p>
      </section>
      <section><h2>Retention</h2>
        <p>{contacts.configured ? 'Retention periods follow the schedule published by the operator.' : 'The retention and deletion schedule must be approved and published by the deploying authority before real reports are accepted.'}</p>
      </section>
      <section><h2>Important</h2>
        <p>CivicChai is not an emergency service or a statutory grievance or appeal channel unless the responsible authority formally adopts it. For emergencies call 112.</p>
      </section>
    </LegalPage>
  )
}
