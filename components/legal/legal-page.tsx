import { SiteNav } from '@/components/landing/site-nav'
import { SiteFooter } from '@/components/landing/site-footer'

export function LegalPage({ eyebrow, title, intro, children }: { eyebrow: string; title: string; intro: string; children: React.ReactNode }) {
  return (
    <main className="min-h-dvh bg-background text-charcoal">
      <SiteNav />
      <article className="mx-auto max-w-3xl px-4 py-12 sm:px-6">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-terracotta">{eyebrow}</p>
        <h1 className="mt-3 font-display text-3xl font-extrabold sm:text-4xl">{title}</h1>
        <p className="mt-4 text-base leading-relaxed text-charcoal/70">{intro}</p>
        <div className="mt-8 space-y-8 text-sm leading-relaxed text-charcoal/80 [&_h2]:font-display [&_h2]:text-lg [&_h2]:font-bold [&_h2]:text-charcoal [&_li]:ml-5 [&_li]:list-disc [&_p]:mt-2 [&_ul]:mt-2 [&_ul]:space-y-1.5">{children}</div>
      </article>
      <SiteFooter />
    </main>
  )
}
