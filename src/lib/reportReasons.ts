/** The reasons a player can be reported for, as the report dialog shows them. */
import { REPORT_REASONS, type ReportReason } from './apiTypes'
import { REPORT_REASON_LABELS } from './labels'

const HINTS: Record<ReportReason, string> = {
  cheating: 'The run looks automated or faked.',
  name: 'The player’s name is abusive or inappropriate.',
  other: 'Tell the moderator in the note.',
}

export const REASONS = REPORT_REASONS.map((id) => ({ id, label: REPORT_REASON_LABELS[id], hint: HINTS[id] }))
