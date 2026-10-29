import { cn } from '@/lib/utils'

/**
 * A count in a glass capsule like the switch track, lit by a light ring just inside its border; the ring is its own
 * layer, since a shadow class would replace the glass shadows. On so small a capsule the bottom glow and the hard
 * edged gloss read as bands, so it drops the glow and fades the gloss out.
 */
export const CountBadge = ({ count, className }: { readonly count: number; readonly className?: string }) => (
  <span
    className={cn(
      'glass-toggle inline-flex h-4 shrink-0 items-center rounded-full bg-none! px-1.5 text-[10px] tabular-nums [--glass-gloss:linear-gradient(to_bottom,oklch(1_0_0/80%),transparent)] dark:[--glass-gloss:linear-gradient(to_bottom,oklch(1_0_0/14%),transparent)]',
      className,
    )}
  >
    {count}
    <span
      aria-hidden
      className="pointer-events-none absolute inset-px rounded-full ring-1 ring-white/70 dark:ring-white/12"
    />
  </span>
)
