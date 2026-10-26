import type { Metadata } from 'next'
import Link from 'next/link'
import { MapPin, ShieldAlert, ShieldCheck } from 'lucide-react'
import { SiteNav } from '@/components/landing/site-nav'
import { SiteFooter } from '@/components/landing/site-footer'
import { verifyQrToken } from '@/lib/qr'

export const metadata: Metadata = { title: 'CivicChai locality QR', robots: { index: false, follow: false } }

export default async function QrLandingPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  const area = verifyQrToken(decodeURIComponent(token))
  const reportHref = `/citizen?report=1&area=${encodeURIComponent(token)}`

  return (
    <main className="min-h-dvh bg-background text-charcoal">
      <SiteNav />
      <section className="mx-auto max-w-lg px-4 py-12 sm:px-6">
        {area ? (
          <div className="rounded-3xl border border-leaf/30 bg-card p-6 shadow-sm">
            <p className="inline-flex items-center gap-1.5 rounded-full bg-leaf/10 px-3 py-1 text-xs font-semibold text-leaf"><ShieldCheck className="h-3.5 w-3.5" />Verified CivicChai QR code</p>
            <h1 className="mt-4 flex items-start gap-2 font-display text-2xl font-extrabold"><MapPin className="mt-1 h-5 w-5 shrink-0 text-terracotta" />{area.locality}</h1>
            <p className="mt-1 text-sm text-charcoal/65">PIN {area.pin}{area.ward ? ` · ${area.ward}` : ''}</p>
            <p className="mt-4 text-sm leading-relaxed text-charcoal/70">This code was placed by the local authority to identify this area. Reporting here fills in the area for you. It is not proof of where you live, and you can change the location.</p>
            <div className="mt-6 grid gap-3">
              <Link href={reportHref} className="rounded-xl bg-terracotta px-4 py-3 text-center text-sm font-semibold text-cream">Report a problem here</Link>
              <Link href="/citizen" className="rounded-xl border border-border px-4 py-3 text-center text-sm font-semibold text-chai">See local issues</Link>
            </div>
          </div>
        ) : (
          <div className="rounded-3xl border border-heat/30 bg-card p-6 shadow-sm">
            <p className="inline-flex items-center gap-1.5 rounded-full bg-heat/10 px-3 py-1 text-xs font-semibold text-heat"><ShieldAlert className="h-3.5 w-3.5" />Not a verified code</p>
            <h1 className="mt-4 font-display text-2xl font-extrabold">This QR code could not be verified</h1>
            <p className="mt-3 text-sm leading-relaxed text-charcoal/70">It may have been altered or not issued by the authority. Do not enter personal details from a link you do not trust. You can still report through the official CivicChai app.</p>
            <Link href="/citizen" className="mt-6 inline-flex rounded-xl bg-chai px-4 py-3 text-sm font-semibold text-cream">Open CivicChai</Link>
          </div>
        )}
      </section>
      <SiteFooter />
    </main>
  )
}
