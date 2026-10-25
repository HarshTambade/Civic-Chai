'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Logo } from '@/components/brand/logo'
import { useLanguage } from '@/components/language-provider'
import { useAuth } from '@/components/auth-provider'
import { languageOptions } from '@/lib/i18n'
import { LogOut, Menu, X } from 'lucide-react'

const LINKS = [
  { labelKey: 'localChai', href: '/citizen' },
  { labelKey: 'howItWorks', href: '/how-it-works' },
  { labelKey: 'chaiTapri', href: '/chai-tapri' },
  { labelKey: 'authorityLogin', href: '/control-room' },
  { labelKey: 'about', href: '/about' },
]

export function SiteNav() {
  const [open, setOpen] = useState(false)
  const { language, setLanguage, t } = useLanguage()
  const { user, logout } = useAuth()
  const accountHref = user && user.role !== 'citizen' ? '/control-room' : '/citizen'
  const accountLabel = user ? user.role === 'citizen' ? user.handle ?? 'My account' : 'Control Room' : ''
  const label = (key: string) => key === 'authorityLogin' ? t.nav.authorityLogin
    : key === 'localChai' ? t.nav.localChai
      : key === 'howItWorks' ? t.nav.howItWorks
        : key === 'chaiTapri' ? t.nav.chaiTapri
          : t.nav.about

  return (
    <header className="sticky top-0 z-50 border-b border-border/70 bg-cream/85 backdrop-blur-md">
      <nav className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-4 sm:px-6">
        <Link href="/" aria-label="CivicChai home" className="shrink-0">
          <Logo />
        </Link>

        {/* Full link row only where it fits on one line; smaller screens use the menu. */}
        <div className="hidden min-w-0 items-center gap-5 xl:flex 2xl:gap-6">
          {LINKS.map((l) => (
            <Link
              key={l.labelKey}
              href={l.href}
              className="whitespace-nowrap text-sm font-medium text-charcoal/70 transition-colors hover:text-chai"
            >
              {label(l.labelKey)}
            </Link>
          ))}
        </div>

        <div className="ml-auto hidden shrink-0 items-center gap-2 lg:flex xl:ml-0">
          <select
            value={language}
            onChange={(event) => setLanguage(event.target.value as 'en' | 'hi' | 'mr')}
            className="rounded-lg border border-border bg-background px-2 py-1.5 text-sm text-charcoal outline-none"
            aria-label="Select language"
          >
            {languageOptions.map((option) => (
              <option key={option.code} value={option.code}>
                {option.label}
              </option>
            ))}
          </select>
          {user ? <>
            <Link href={accountHref} title={accountLabel} aria-label={`Your account: ${accountLabel}`} className="flex items-center gap-2 rounded-full py-1 pl-1 pr-1 text-sm font-semibold text-chai transition-colors hover:bg-chai/10 2xl:pr-3">
              <span aria-hidden className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-chai/15 text-xs font-bold">{accountLabel.slice(0, 2).toUpperCase()}</span>
              <span className="hidden max-w-32 truncate 2xl:inline">{accountLabel}</span>
            </Link>
            <button type="button" onClick={() => void logout()} aria-label="Sign out" title="Sign out" className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-charcoal/65 transition-colors hover:bg-chai/10">
              <LogOut className="h-4 w-4" />
            </button>
          </> : <Link
            href="/login"
            className="whitespace-nowrap rounded-lg px-3 py-2 text-sm font-semibold text-chai transition-colors hover:bg-chai/10"
          >
            Sign in
          </Link>}
          <Link
            href="/citizen"
            className="whitespace-nowrap rounded-lg bg-chai px-4 py-2 text-sm font-semibold text-cream shadow-sm transition-colors hover:bg-chai/90"
          >
            {t.nav.startCharcha}
          </Link>
        </div>

        <button
          className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-chai xl:hidden"
          onClick={() => setOpen((o) => !o)}
          aria-label={open ? 'Close menu' : 'Open menu'}
          aria-expanded={open}
        >
          {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </nav>

      {open && (
        <div className="border-t border-border bg-cream px-4 py-4 xl:hidden">
          <div className="flex flex-col gap-1">
            {LINKS.map((l) => (
              <Link
                key={l.labelKey}
                href={l.href}
                onClick={() => setOpen(false)}
                className="rounded-lg px-3 py-2.5 text-sm font-medium text-charcoal/80 hover:bg-chai/10"
              >
                {label(l.labelKey)}
              </Link>
            ))}
            <div className="mt-2 rounded-lg border border-border bg-background px-3 py-2">
              <select
                value={language}
                onChange={(event) => setLanguage(event.target.value as 'en' | 'hi' | 'mr')}
                className="w-full bg-transparent text-sm text-charcoal outline-none"
                aria-label="Select language"
              >
                {languageOptions.map((option) => (
                  <option key={option.code} value={option.code}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
            {user ? <>
              <Link href={accountHref} onClick={() => setOpen(false)} className="rounded-lg px-3 py-2.5 text-sm font-semibold text-chai hover:bg-chai/10">
                {user.role === 'citizen' ? `Signed in as ${user.handle ?? 'citizen'}` : 'Open Control Room'}
              </Link>
              <button type="button" onClick={() => { setOpen(false); void logout() }} className="flex items-center gap-2 rounded-lg px-3 py-2.5 text-left text-sm font-semibold text-charcoal/70 hover:bg-chai/10">
                <LogOut className="h-4 w-4" />Sign out
              </button>
            </> : <Link
              href="/login"
              onClick={() => setOpen(false)}
              className="rounded-lg px-3 py-2.5 text-sm font-semibold text-chai hover:bg-chai/10"
            >
              Sign in
            </Link>}
            <Link
              href="/citizen"
              onClick={() => setOpen(false)}
              className="mt-2 rounded-lg bg-chai px-4 py-2.5 text-center text-sm font-semibold text-cream"
            >
              {t.nav.startCharcha}
            </Link>
          </div>
        </div>
      )}
    </header>
  )
}
