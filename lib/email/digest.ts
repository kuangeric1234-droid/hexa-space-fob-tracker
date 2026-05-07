import { Resend } from 'resend'
import { formatDate, formatCurrency, daysOverdue } from '@/lib/utils'
import type { AssignmentWithRelations } from '@/types'

function getResend() {
  return new Resend(process.env.RESEND_API_KEY)
}

interface DigestData {
  overdue: AssignmentWithRelations[]
  cancelledWithFobs: AssignmentWithRelations[]
  unpaidOld: AssignmentWithRelations[]
}

export async function sendDigestEmail(to: string, data: DigestData): Promise<void> {
  const { overdue, cancelledWithFobs, unpaidOld } = data
  const total = overdue.length + cancelledWithFobs.length + unpaidOld.length

  if (total === 0) return

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://hexa-fob-tracker.vercel.app'

  const sections: string[] = []

  if (overdue.length > 0) {
    sections.push(`Overdue returns (${overdue.length}):`)
    for (const a of overdue) {
      const member = (a.member as any)
      const fob = (a.fob as any)
      sections.push(
        `  - ${member?.name ?? 'Unknown'} — ${member?.suite ?? 'No suite'} — ${fob?.serial_number} — ${daysOverdue(a.expected_return_at)} days overdue`
      )
    }
    sections.push('')
  }

  if (cancelledWithFobs.length > 0) {
    sections.push(`Members cancelled with active fobs (${cancelledWithFobs.length}):`)
    const byMember: Record<string, AssignmentWithRelations[]> = {}
    for (const a of cancelledWithFobs) {
      const mid = a.member_id
      byMember[mid] ??= []
      byMember[mid].push(a)
    }
    for (const [, assignments] of Object.entries(byMember)) {
      const member = (assignments[0].member as any)
      sections.push(
        `  - ${member?.name ?? 'Unknown'} — ${member?.suite ?? 'No suite'} — ${assignments.length} fob(s) still held`
      )
    }
    sections.push('')
  }

  if (unpaidOld.length > 0) {
    sections.push(`Unpaid deposits >30 days (${unpaidOld.length}):`)
    for (const a of unpaidOld) {
      const member = (a.member as any)
      const fob = (a.fob as any)
      sections.push(
        `  - ${member?.name ?? 'Unknown'} — Fob ${fob?.serial_number} — issued ${formatDate(a.issued_at)} — ${formatCurrency(a.deposit_amount)}`
      )
    }
    sections.push('')
  }

  sections.push(`Open dashboard: ${appUrl}`)

  const text = sections.join('\n')

  const html = `<pre style="font-family: monospace; font-size: 14px; line-height: 1.6; color: #111;">${text}</pre>`

  await getResend().emails.send({
    from: 'Hexa Fob Tracker <noreply@hexaspace.com>',
    to,
    subject: `Hexa fob tracker — ${total} item${total !== 1 ? 's' : ''} need attention`,
    text,
    html,
  })
}
