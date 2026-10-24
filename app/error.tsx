'use client'

export default function RouteError({ retry }: { error: unknown; retry: () => void }) {
  return (
    <main role="alert" className="flex min-h-dvh items-center justify-center bg-background px-5 text-center text-charcoal">
      <section className="max-w-md rounded-2xl border border-border bg-card p-8 shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-terracotta">Something went wrong</p>
        <h1 className="mt-3 font-display text-2xl font-extrabold">This page could not load</h1>
        <p className="mt-2 text-sm leading-relaxed text-charcoal/65">If you were filing a report, review your account before trying again.</p>
        <div className="mt-5 flex flex-wrap justify-center gap-3">
          <button type="button" onClick={retry} className="rounded-xl bg-chai px-4 py-3 text-sm font-semibold text-cream">Try again</button>
          <a href="/" className="rounded-xl border border-border px-4 py-3 text-sm font-semibold text-charcoal">Return home</a>
        </div>
      </section>
    </main>
  )
}
