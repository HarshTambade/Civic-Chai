'use client'

import { useAuth } from '@/components/auth-provider'
import { ControlRoom } from '@/components/gov/control-room'
import { ControlRoomLogin } from '@/components/gov/control-room-login'
import { useRouter } from 'next/navigation'
import { GOV_ROLES, ROLE_LABELS } from '@/lib/roles'

export function ControlRoomPage() {
  const { isAuthenticated, user, isHydrated } = useAuth()
  const router = useRouter()
  if (!isHydrated) {
    return null
  }

  if (!isAuthenticated) {
    return <ControlRoomLogin />
  }

  if (user?.role === 'citizen') {
    return (
      <main className="flex min-h-dvh items-center justify-center bg-background p-6 text-center">
        <div className="max-w-md rounded-2xl border border-border bg-card p-8 shadow-sm">
          <h1 className="font-display text-2xl font-extrabold text-charcoal">Citizen portal account</h1>
          <p className="mt-2 text-sm text-charcoal/65">{ROLE_LABELS.citizen} accounts use the Citizen Portal. Government and oversight tools require an authorized role.</p>
          <button onClick={() => router.replace('/citizen')} className="mt-5 rounded-xl bg-chai px-5 py-3 text-sm font-semibold text-cream">Open Citizen Portal</button>
        </div>
      </main>
    )
  }

  if (user && !GOV_ROLES.includes(user.role)) return <ControlRoomLogin />

  return <ControlRoom />
}
