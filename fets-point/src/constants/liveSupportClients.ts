/**
 * Shared vendor tiles: Live Support (external links) and Quick Access (credentials modal) use the same logos/order.
 * Quick Access adds FETS for internal credentials only.
 */
export type QuickAccessClientSlug = 'prometric' | 'pearson' | 'psi' | 'celpip' | 'itts' | 'fets'

export type LiveSupportClientDef = {
  slug: QuickAccessClientSlug
  name: string
  /** Official support portal — opens in new tab from Live Support section */
  supportUrl: string
  image: string
}

/** Same five vendors as Live Support — all logos shown in both sections */
export const LIVE_SUPPORT_CLIENTS: LiveSupportClientDef[] = [
  { slug: 'prometric', name: 'Prometric', supportUrl: 'https://ehelp.prometric.com/', image: '/live-support/prometric.png' },
  { slug: 'pearson', name: 'Pearson Vue', supportUrl: 'https://www.pearsonvue.com/us/en/help/chat.html', image: '/live-support/pearson-vue.png' },
  { slug: 'psi', name: 'PSI', supportUrl: 'https://gps.psiexams.com/test-center-alerts', image: '/live-support/psi.png' },
  { slug: 'celpip', name: 'CELPIP', supportUrl: 'https://ehelp.prometric.com/Paragon', image: '/live-support/celpip.png' },
  { slug: 'itts', name: 'ITTS', supportUrl: 'https://tds.surpass.com/help/', image: '/live-support/itts.png' },
]

/** Quick Access only — internal FETS credentials */
export const QUICK_ACCESS_EXTRA: { slug: QuickAccessClientSlug; name: string; image?: string }[] = [
  { slug: 'fets', name: 'FETS' },
]
