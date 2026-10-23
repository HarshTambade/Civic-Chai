import { cn } from '@/lib/utils'
import Image from 'next/image'

interface LogoProps {
  className?: string
  showWordmark?: boolean
  variant?: 'default' | 'inverted'
}

/** Shared Cockroach Janta Party emblem and CivicChai wordmark. */
export function Logo({
  className,
  showWordmark = true,
  variant = 'default',
}: LogoProps) {
  const wordColor =
    variant === 'inverted' ? 'text-cream' : 'text-chai'
  return (
    <div className={cn('flex items-center gap-2.5', className)}>
      <span className="relative inline-flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-full">
        <Image
          src="/icon.svg"
          alt=""
          width={36}
          height={36}
          unoptimized
          className="h-full w-full object-contain"
        />
      </span>
      {showWordmark && (
        <span className={cn('font-display text-lg font-extrabold tracking-tight', wordColor)}>
          Civic<span className="text-terracotta">Chai</span>
        </span>
      )}
    </div>
  )
}
