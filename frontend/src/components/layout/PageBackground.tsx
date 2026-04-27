/**
 * Decorative full-page background: subtle grid + two animated blurred
 * accent blobs. Place once near the top of any page.
 */
export default function PageBackground() {
  return (
    <div
      aria-hidden
      className="pointer-events-none fixed inset-0 -z-10 overflow-hidden"
    >
      <div className="bg-grid-fade absolute inset-0" />
      <div
        className="animate-float absolute -top-32 left-1/4 h-[28rem] w-[28rem] rounded-full bg-[var(--color-accent)]/10 blur-3xl"
      />
      <div
        className="animate-float-delayed absolute -bottom-40 right-1/4 h-[32rem] w-[32rem] rounded-full bg-emerald-500/5 blur-3xl"
      />
    </div>
  )
}
