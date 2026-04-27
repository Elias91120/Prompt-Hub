/**
 * Per-phase color palette. Each phase rotates through these so the graph
 * has visual variety without losing the design system.
 *
 * `accent` is the strong color, `glow` is a low-alpha version for soft
 * shadows / borders, `bgRing` is for backgrounds, `text` for labels.
 */

import type { JSX } from 'react'

export interface PhasePalette {
  name: string
  accent: string // hex
  accentSoft: string // hex with alpha
  glow: string // rgba/hex with alpha
  ring: string // tailwind-arbitrary-friendly hex/rgba
  pillBg: string
  textOn: string // text color on accent bg
  icon: JSX.Element
}

const ICONS = {
  rocket: (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
      <path
        d="M11 2L14 5L9 10L8 13L5 10L2 9L7 4L11 2Z"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
      <circle cx="10.5" cy="5.5" r="1" fill="currentColor" />
    </svg>
  ),
  layers: (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
      <path d="M8 2L14 5L8 8L2 5L8 2Z" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" />
      <path d="M2 8L8 11L14 8" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" />
      <path d="M2 11L8 14L14 11" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" />
    </svg>
  ),
  spark: (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
      <path d="M8 2L9.5 6.5L14 8L9.5 9.5L8 14L6.5 9.5L2 8L6.5 6.5L8 2Z" fill="currentColor" />
    </svg>
  ),
  cog: (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
      <path
        d="M8 2v2M8 12v2M2 8h2M12 8h2M3.8 3.8l1.4 1.4M10.8 10.8l1.4 1.4M3.8 12.2l1.4-1.4M10.8 5.2l1.4-1.4"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
      />
      <circle cx="8" cy="8" r="2.5" stroke="currentColor" strokeWidth="1.4" />
    </svg>
  ),
  flag: (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
      <path d="M3 2v12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <path
        d="M3 3h8l-2 2.5L11 8H3"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinejoin="round"
        fill="currentColor"
        fillOpacity="0.15"
      />
    </svg>
  ),
}

export const PHASE_PALETTE: PhasePalette[] = [
  {
    name: 'emerald',
    accent: '#3ecf8e',
    accentSoft: '#3ecf8e22',
    glow: 'rgba(62, 207, 142, 0.18)',
    ring: 'rgba(62, 207, 142, 0.45)',
    pillBg: 'rgba(62, 207, 142, 0.12)',
    textOn: '#031a10',
    icon: ICONS.rocket,
  },
  {
    name: 'sky',
    accent: '#38bdf8',
    accentSoft: '#38bdf822',
    glow: 'rgba(56, 189, 248, 0.18)',
    ring: 'rgba(56, 189, 248, 0.45)',
    pillBg: 'rgba(56, 189, 248, 0.12)',
    textOn: '#031826',
    icon: ICONS.layers,
  },
  {
    name: 'violet',
    accent: '#a78bfa',
    accentSoft: '#a78bfa22',
    glow: 'rgba(167, 139, 250, 0.20)',
    ring: 'rgba(167, 139, 250, 0.45)',
    pillBg: 'rgba(167, 139, 250, 0.12)',
    textOn: '#0d0524',
    icon: ICONS.spark,
  },
  {
    name: 'amber',
    accent: '#f59e0b',
    accentSoft: '#f59e0b22',
    glow: 'rgba(245, 158, 11, 0.18)',
    ring: 'rgba(245, 158, 11, 0.45)',
    pillBg: 'rgba(245, 158, 11, 0.12)',
    textOn: '#1c0c00',
    icon: ICONS.cog,
  },
  {
    name: 'rose',
    accent: '#fb7185',
    accentSoft: '#fb718522',
    glow: 'rgba(251, 113, 133, 0.18)',
    ring: 'rgba(251, 113, 133, 0.45)',
    pillBg: 'rgba(251, 113, 133, 0.12)',
    textOn: '#22050a',
    icon: ICONS.flag,
  },
]

export function paletteFor(colorIndex: number): PhasePalette {
  return PHASE_PALETTE[colorIndex % PHASE_PALETTE.length]
}
