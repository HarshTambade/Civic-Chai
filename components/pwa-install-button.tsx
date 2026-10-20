'use client'

import { useEffect, useState } from 'react'
import { Download } from 'lucide-react'

export function PwaInstallButton({ className = '' }: { className?: string }) {
  const [available, setAvailable] = useState(false)
  const [installed, setInstalled] = useState(false)

  useEffect(() => {
    setInstalled(window.matchMedia('(display-mode: standalone)').matches || Boolean((navigator as Navigator & { standalone?: boolean }).standalone))
    const ready = () => setAvailable(true)
    const installedNow = () => { setInstalled(true); setAvailable(false) }
    window.addEventListener('civicchai:install-ready', ready)
    window.addEventListener('appinstalled', installedNow)
    return () => {
      window.removeEventListener('civicchai:install-ready', ready)
      window.removeEventListener('appinstalled', installedNow)
    }
  }, [])

  async function install() {
    const prompt = window.civicChaiInstallPrompt
    if (!prompt) return
    await prompt.prompt()
    const result = await prompt.userChoice
    if (result.outcome === 'accepted') setAvailable(false)
    window.civicChaiInstallPrompt = undefined
  }

  if (!available || installed) return null
  return <button type="button" onClick={install} className={className}><Download className="h-4 w-4" /> Install app</button>
}
