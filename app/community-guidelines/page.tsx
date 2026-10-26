import type { Metadata } from 'next'
import Link from 'next/link'
import { LegalPage } from '@/components/legal/legal-page'
import { legalContacts } from '@/lib/legal'
import { pageMetadata } from '@/lib/seo'

export const metadata: Metadata = pageMetadata({ title: 'Community guidelines', description: 'Rules for civic discussion on CivicChai, how content is moderated, and how to appeal.', path: '/community-guidelines' })

export default function CommunityGuidelinesPage() {
  const contacts = legalContacts()
  return (
    <LegalPage eyebrow="Community guidelines" title="Rules for a good Charcha" intro="CivicChai is for reporting and discussing local civic problems. Criticism of public services is welcome. These rules keep the discussion useful and safe for everyone.">
      <section><h2>Please do</h2>
        <ul><li>Describe the problem, where it is and since when.</li><li>Add helpful updates and evidence, such as whether a repair actually happened.</li><li>Support an existing issue instead of filing the same problem again.</li></ul>
      </section>
      <section><h2>Do not post</h2>
        <ul><li>Personal information about anyone: phone numbers, home addresses, identity numbers or photos of private individuals.</li><li>Abuse, threats, harassment or hate against any person or group.</li><li>Spam, advertising, or repeated or automated posts and votes.</li><li>False reports, or content you know to be misleading.</li><li>Anything unlawful.</li></ul>
      </section>
      <section><h2>How moderation works</h2>
        <ul><li>Anyone signed in can report an issue or comment with the shield button.</li><li>A moderator reviews the report and records the reason for every decision. Good-faith criticism is not removed just because it is critical.</li><li>Actioned content is hidden from the public but kept for the record.</li><li>Support counts are one per account and are monitored for manipulation.</li></ul>
      </section>
      <section><h2>Appeals</h2>
        <p>If you reported content, you can appeal the decision from <Link href="/citizen" className="font-semibold text-chai underline">Profile → Content reports &amp; appeals</Link>. Another review is recorded with a reason.</p>
        <p className="mt-2">Grievance officer: {contacts.grievanceOfficer}{contacts.grievanceEmail ? ` · ${contacts.grievanceEmail}` : ''}</p>
      </section>
    </LegalPage>
  )
}
