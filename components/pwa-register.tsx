'use client'

import { useEffect } from 'react'

declare global {
  interface BeforeInstallPromptEvent extends Event {
    prompt: () => Promise<void>
    userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
  }
  interface Window {
    civicChaiInstallPrompt?: BeforeInstallPromptEvent
  }
}

export function PwaRegister() {
  useEffect(() => {
    if (!('serviceWorker' in navigator)) return
    let active = true
    const register = () => {
      if (active) void navigator.serviceWorker.register('/sw.js', { scope: '/' }).catch((error) => console.warn('CivicChai offline mode could not start:', error))
    }
    if (document.readyState === 'complete') register()
    else window.addEventListener('load', register, { once: true })

    const onInstall = (event: Event) => {
      event.preventDefault()
      window.civicChaiInstallPrompt = event as BeforeInstallPromptEvent
      window.dispatchEvent(new CustomEvent('civicchai:install-ready'))
    }
    window.addEventListener('beforeinstallprompt', onInstall)
    return () => {
      active = false
      window.removeEventListener('load', register)
      window.removeEventListener('beforeinstallprompt', onInstall)
    }
  }, [])
  return null
}
