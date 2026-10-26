'use client'

import { useEffect, useState } from 'react'
import { ExternalLink, FileText, MapPin, ShieldCheck, UserRound } from 'lucide-react'
import { SiteNav } from '@/components/landing/site-nav'
import { SiteFooter } from '@/components/landing/site-footer'
import { useServiceArea } from '@/components/citizen/use-service-area'

type Registry = {
  jurisdiction?: { name: string; level: string } | null
  hubs?: Array<{ id: string; name: string; address: string; ward?: string; public_phone?: string; public_email?: string; source_url: string; source_version: string; verified_at?: string }>
  officers?: Array<{ id: string; name: string; role: string; department: string; hub: string; public_phone?: string; public_email?: string; source_url: string }>
  documents?: Array<{ id: string; title: string; authority: string; issuing_authority?: string; document_number?: string; source_url: string; published_at: string; version?: string }>
  sla_targets?: Array<{ id: string; target_hours: number; source_url: string; source_version: string; departments?: { name: string } | null; categories?: { name: string } | null }>
}

/** SOP "Knowledge / Documents": verified, source-linked civic information for a PIN. */
export default function KnowledgePage() {
  const area = useServiceArea()
  const [pin, setPin] = useState('')
  const [registry, setRegistry] = useState<Registry | null>(null)
  const [message, setMessage] = useState('')

  useEffect(() => { if (area.loaded && area.pin) setPin((current) => current || area.pin) }, [area.loaded, area.pin])

  useEffect(() => {
    if (!/^\d{6}$/.test(pin)) { setRegistry(null); return }
    let cancelled = false
    setMessage('Loading verified records…')
    fetch(`/api/public/registry?pin=${pin}`).then(async (response) => {
      const payload = await response.json()
      if (!response.ok) throw new Error(payload.error ?? 'The registry is unavailable.')
      if (!cancelled) { setRegistry(payload); setMessage('') }
    }).catch((error) => { if (!cancelled) setMessage(error instanceof Error ? error.message : 'The registry is unavailable.') })
    return () => { cancelled = true }
  }, [pin])

  const empty = registry && !registry.hubs?.length && !registry.officers?.length && !registry.documents?.length && !registry.sla_targets?.length

  return (
    <main className="min-h-dvh bg-background text-charcoal">
      <SiteNav />
      <section className="mx-auto max-w-4xl px-4 py-12 sm:px-6">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-terracotta">Civic knowledge</p>
        <h1 className="mt-3 font-display text-3xl font-extrabold sm:text-4xl">Who handles civic work in your area?</h1>
        <p className="mt-3 max-w-2xl text-sm leading-relaxed text-charcoal/70">Only records that the authority has checked against an official government source are shown. CivicChai never guesses an office, officer, law or deadline. This is educational information, not legal advice.</p>
        <label className="mt-6 block max-w-xs text-xs font-semibold text-charcoal/65">PIN code
          <input value={pin} onChange={(event) => setPin(event.target.value.replace(/\D/g, '').slice(0, 6))} inputMode="numeric" maxLength={6} placeholder="e.g. 401208" className="mt-1 w-full rounded-xl border border-border bg-card px-3 py-2.5 font-mono text-lg tracking-widest" />
        </label>
        {message && <p role="status" className="mt-4 text-sm text-charcoal/60">{message}</p>}
        {empty && <p className="mt-6 rounded-2xl border border-dashed border-border bg-card p-6 text-sm text-charcoal/65">No verified offices, officers or documents are published for PIN {pin} yet. The local authority adds them after checking official sources.</p>}

        {registry && !empty && <div className="mt-8 space-y-6">
          {registry.jurisdiction && <p className="text-sm text-charcoal/70">Jurisdiction: <b>{registry.jurisdiction.name}</b> ({registry.jurisdiction.level})</p>}
          {Boolean(registry.hubs?.length) && <section><h2 className="flex items-center gap-2 font-display text-lg font-bold"><MapPin className="h-5 w-5 text-terracotta" />Local hubs and offices</h2><div className="mt-3 grid gap-3 sm:grid-cols-2">{registry.hubs!.map((hub) => <article key={hub.id} className="rounded-2xl border border-leaf/30 bg-card p-4"><p className="flex items-center gap-2 font-semibold"><ShieldCheck className="h-4 w-4 text-leaf" />{hub.name}</p><p className="mt-1 text-sm text-charcoal/70">{hub.address}{hub.ward ? ` · ${hub.ward}` : ''}</p><p className="mt-2 flex flex-wrap gap-3 text-xs">{hub.public_phone && <a href={`tel:${hub.public_phone}`} className="underline">{hub.public_phone}</a>}{hub.public_email && <a href={`mailto:${hub.public_email}`} className="underline">{hub.public_email}</a>}<a href={hub.source_url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 underline">Official source <ExternalLink className="h-3 w-3" /></a></p></article>)}</div></section>}
          {Boolean(registry.officers?.length) && <section><h2 className="flex items-center gap-2 font-display text-lg font-bold"><UserRound className="h-5 w-5 text-terracotta" />Published officers</h2><div className="mt-3 grid gap-3 sm:grid-cols-2">{registry.officers!.map((officer) => <article key={officer.id} className="rounded-2xl border border-border bg-card p-4"><p className="font-semibold">{officer.role}</p><p className="text-sm text-charcoal/70">{officer.name} · {officer.department}</p><p className="mt-2 flex flex-wrap gap-3 text-xs">{officer.public_phone && <a href={`tel:${officer.public_phone}`} className="underline">{officer.public_phone}</a>}{officer.public_email && <a href={`mailto:${officer.public_email}`} className="underline">{officer.public_email}</a>}<a href={officer.source_url} target="_blank" rel="noreferrer" className="underline">Source</a></p></article>)}</div></section>}
          {Boolean(registry.documents?.length) && <section><h2 className="flex items-center gap-2 font-display text-lg font-bold"><FileText className="h-5 w-5 text-terracotta" />Official documents and rules</h2><ul className="mt-3 space-y-2">{registry.documents!.map((doc) => <li key={doc.id} className="rounded-xl bg-card p-3"><a href={doc.source_url} target="_blank" rel="noreferrer" className="font-semibold text-chai underline">{doc.title}</a><p className="text-xs text-charcoal/60">{doc.issuing_authority ?? doc.authority}{doc.document_number ? ` · ${doc.document_number}` : ''} · published {new Date(doc.published_at).toLocaleDateString('en-IN')} · version {doc.version ?? '1'}</p></li>)}</ul><p className="mt-2 text-[11px] text-charcoal/50">A CivicChai link is a pointer to the issuing authority&apos;s original record, not a replacement for it.</p></section>}
          {Boolean(registry.sla_targets?.length) && <section><h2 className="font-display text-lg font-bold">Published service targets</h2><ul className="mt-3 space-y-1.5 text-sm">{registry.sla_targets!.map((target) => <li key={target.id}>{target.target_hours} hours · {target.departments?.name ?? 'All departments'}{target.categories?.name ? ` · ${target.categories.name}` : ''} · <a href={target.source_url} target="_blank" rel="noreferrer" className="underline">source {target.source_version}</a></li>)}</ul></section>}
        </div>}
      </section>
      <SiteFooter />
    </main>
  )
}
