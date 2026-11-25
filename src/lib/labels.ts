/** Names shown for the API's ids, shared by the game and the admin page. */
import type { Provider, ReportReason } from './apiTypes'

export const PROVIDER_NAMES: Record<Provider, string> = { github: 'GitHub', google: 'Google' }

/** Why a run or name is reported: the reporter's choice, and the admin's label for it. */
export const REPORT_REASON_LABELS: Record<ReportReason, string> = { cheating: 'Cheating', name: 'Offensive name', other: 'Something else' }
