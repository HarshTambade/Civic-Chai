import Link from 'next/link'

export default function OfflinePage() {
  return (
    <main className="flex min-h-dvh items-center justify-center bg-background px-5 text-center text-charcoal">
      <div className="max-w-md rounded-2xl border border-border bg-card p-8 shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-terracotta">Offline mode</p>
        <h1 className="mt-3 font-display text-3xl font-extrabold">You can keep preparing your complaint</h1>
        <p className="mt-3 text-sm leading-relaxed text-charcoal/65">Cached civic information and saved drafts remain on this device. A report is official only after the server confirms it.</p>
        <Link href="/citizen" className="mt-6 inline-flex rounded-xl bg-chai px-5 py-3 text-sm font-semibold text-cream">Open Citizen Portal</Link>
      </div>
    </main>
  )
}
