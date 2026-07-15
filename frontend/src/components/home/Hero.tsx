import { useEffect, useRef, useState } from 'react'
import { motion } from 'framer-motion'
import { ArrowRight, FolderPlus, Sparkles, UserPlus, Terminal } from 'lucide-react'
import { useTranslation } from 'react-i18next'

interface Props {
  isAuthed: boolean
  onCreate: () => void
  onScrollToProjects: () => void
}

const WORDS_HIGHLIGHT = ['IA', 'intelligents', 'automatique', 'précision']

export default function Hero({ isAuthed, onCreate, onScrollToProjects }: Props) {
  const { t } = useTranslation('home')
  const containerRef = useRef<HTMLDivElement>(null)
  const orbRef = useRef<HTMLDivElement>(null)
  const [orbPos, setOrbPos] = useState({ x: 0, y: 0 })
  const [isHovered, setIsHovered] = useState(false)

  // Cursor-tracking orb glow
  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const handleMove = (e: MouseEvent) => {
      const rect = el.getBoundingClientRect()
      setOrbPos({
        x: e.clientX - rect.left,
        y: e.clientY - rect.top,
      })
    }
    el.addEventListener('mousemove', handleMove)
    return () => el.removeEventListener('mousemove', handleMove)
  }, [])

  const containerVariants = {
    hidden: {},
    visible: { transition: { staggerChildren: 0.08 } },
  }
  const wordVariants = {
    hidden: { opacity: 0, y: 28, rotateX: -20 },
    visible: {
      opacity: 1,
      y: 0,
      rotateX: 0,
      transition: { duration: 0.5, ease: 'easeOut' as const },
    },
  }

  const titleWords = (t('hero.title1') + ' ' + t('hero.titleHighlight') + ' ' + t('hero.title2')).split(' ')

  return (
    <section
      id="top"
      ref={containerRef}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      className="relative overflow-hidden px-6 pt-20 pb-24 sm:pt-28 sm:pb-32"
    >
      {/* Background grid */}
      <div className="pointer-events-none absolute inset-0 bg-grid-fade opacity-60" />

      {/* Scan-line effect */}
      <div className="hero-scan-line" />

      {/* Static ambient orbs */}
      <div className="hero-orb hero-orb-green absolute" style={{ width: 600, height: 600, top: '-20%', left: '-10%', opacity: 0.5 }} />
      <div className="hero-orb hero-orb-cyan absolute" style={{ width: 400, height: 400, top: '10%', right: '-5%', opacity: 0.4 }} />
      <div className="hero-orb hero-orb-purple absolute" style={{ width: 300, height: 300, bottom: '0%', left: '40%', opacity: 0.35 }} />

      {/* Cursor-tracking glow */}
      <div
        ref={orbRef}
        className="pointer-events-none absolute rounded-full transition-opacity duration-300"
        style={{
          width: 300,
          height: 300,
          left: orbPos.x - 150,
          top: orbPos.y - 150,
          background: 'radial-gradient(circle, rgba(62, 207, 142, 0.12) 0%, transparent 70%)',
          filter: 'blur(40px)',
          opacity: isHovered ? 1 : 0,
          zIndex: 0,
          transition: 'opacity 0.3s ease',
        }}
      />

      <div className="relative z-10 mx-auto max-w-5xl">
        <motion.div
          initial="hidden"
          animate="visible"
          variants={containerVariants}
          className="flex flex-col items-center text-center"
          style={{ perspective: '1000px' }}
        >
          {/* Eyebrow */}
          <motion.div
            variants={wordVariants}
            className="mb-8 flex flex-col items-center justify-center gap-3 sm:flex-row"
          >
            <span className="eyebrow">
              <Sparkles className="h-3 w-3" />
              {t('hero.eyebrow')}
            </span>
            <span className="hidden h-4 w-px bg-[var(--color-border)] sm:block" />
            <a
              href="https://web-gen-lyart.vercel.app"
              target="_blank"
              rel="noopener noreferrer"
              className="btn-webgen group flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-bold transition-all"
            >
              <Terminal className="h-3 w-3 opacity-70 group-hover:opacity-100" />
              Développé par Webgen
            </a>
          </motion.div>

          {/* Main heading — Syne font, large, word-by-word animation */}
          <h1
            className="font-display text-balance text-5xl font-extrabold leading-[1.05] tracking-tight sm:text-6xl md:text-7xl lg:text-8xl"
            style={{ perspective: '600px' }}
          >
            {/* We render each word separately for stagger */}
            {titleWords.map((word, i) => {
              const isHighlight = WORDS_HIGHLIGHT.some(h => word.toLowerCase().includes(h.toLowerCase()))
              return (
                <motion.span
                  key={i}
                  variants={wordVariants}
                  className={`inline-block mr-[0.25em] ${isHighlight ? 'gradient-text-shimmer' : ''}`}
                  style={{ display: 'inline-block' }}
                >
                  {word}
                </motion.span>
              )
            })}
          </h1>

          {/* Subtitle */}
          <motion.p
            variants={wordVariants}
            className="mt-8 max-w-2xl text-pretty text-base leading-relaxed text-[var(--color-text-secondary)] sm:text-lg"
          >
            {t('hero.subtitle')}
          </motion.p>

          {/* CTAs */}
          <motion.div
            variants={wordVariants}
            className="mt-10 flex flex-col items-center gap-3 sm:flex-row"
          >
            <button onClick={onCreate} className="btn-hero-primary">
              {isAuthed ? (
                <>
                  <FolderPlus className="h-5 w-5 relative z-10" />
                  <span className="relative z-10">{t('hero.ctaPrimaryAuthed')}</span>
                </>
              ) : (
                <>
                  <UserPlus className="h-5 w-5 relative z-10" />
                  <span className="relative z-10">{t('hero.ctaPrimaryAnon')}</span>
                </>
              )}
            </button>
            <button
              onClick={onScrollToProjects}
              className="btn-secondary group"
            >
              {t('hero.ctaSecondary')}
              <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
            </button>
          </motion.div>

          {/* Trust badges */}
          <motion.div
            variants={wordVariants}
            className="mt-10 flex flex-wrap items-center justify-center gap-2 text-xs text-[var(--color-text-tertiary)]"
          >
            <span className="badge badge-success">
              <span className="h-1.5 w-1.5 rounded-full bg-[var(--color-accent)]" />
              {t('hero.badges.free')}
            </span>
            <span className="badge badge-neutral">{t('hero.badges.vllm')}</span>
            <span className="badge badge-neutral">{t('hero.badges.agents')}</span>
            <span className="badge badge-neutral">{t('hero.badges.local')}</span>
          </motion.div>

          {/* Decorative terminal badge */}
          <motion.div
            variants={wordVariants}
            className="mt-12 inline-flex items-center gap-3 rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface-raised)]/80 px-5 py-3 backdrop-blur-sm"
          >
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-[var(--color-accent)]/10 text-[var(--color-accent)]">
              <Terminal className="h-3.5 w-3.5" />
            </span>
            <div className="text-left">
              <p className="font-mono text-[10px] text-[var(--color-text-tertiary)]">Propulsé par</p>
              <p className="font-display text-xs font-semibold text-[var(--color-text-primary)]">
                Mistral AI · OpenAI · Agents multi-étapes
              </p>
            </div>
            <span className="ml-1 flex gap-1">
              <span className="h-2 w-2 rounded-full bg-[var(--color-accent)] animate-glow-pulse" />
              <span className="h-2 w-2 rounded-full bg-[var(--color-cyan)] animate-glow-pulse" style={{animationDelay: '0.5s'}} />
              <span className="h-2 w-2 rounded-full bg-[var(--color-purple)] animate-glow-pulse" style={{animationDelay: '1s'}} />
            </span>
          </motion.div>
        </motion.div>
      </div>
    </section>
  )
}
