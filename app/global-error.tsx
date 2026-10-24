'use client'

import './globals.css'

export default function GlobalError({ retry }: { error: unknown; retry: () => void }) {
  return (
    <html lang="en">
      <body className="antialiased">
        <main role="alert" className="flex min-h-dvh items-center justify-center bg-background px-5 text-center text-charcoal">
          <section className="max-w-md rounded-2xl border border-border bg-card p-8 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-terracotta">CivicChai</p>
            <h1 className="mt-3 font-display text-2xl font-extrabold">We hit a problem</h1>
            <p className="mt-2 text-sm leading-relaxed text-charcoal/65">If you were filing a report, review your account before trying again.</p>
            <button type="button" onClick={retry} className="mt-5 rounded-xl bg-chai px-4 py-3 text-sm font-semibold text-cream">Try again</button>
          </section>
        </main>
      </body>
    </html>
  )
}
