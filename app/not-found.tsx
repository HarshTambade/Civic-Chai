export default function NotFound() {
  return (
    <main className="flex min-h-dvh items-center justify-center bg-background px-5 text-center text-charcoal">
      <section className="max-w-md rounded-2xl border border-border bg-card p-8 shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-terracotta">404 · Not found</p>
        <h1 className="mt-3 font-display text-2xl font-extrabold">We could not find that page</h1>
        <p className="mt-2 text-sm leading-relaxed text-charcoal/65">The address may have changed, or the report is no longer public.</p>
        <a href="/" className="mt-5 inline-flex rounded-xl bg-chai px-4 py-3 text-sm font-semibold text-cream">Return to CivicChai</a>
      </section>
    </main>
  )
}
