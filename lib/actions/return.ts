'use server'

import { createClient } from '@/lib/supabase/server'
import { createRefundFee, voidFee } from '@/lib/officernd/client'
import { z } from 'zod'

const returnSchema = z.object({
  assignment_id: z.string().uuid(),
  return_notes: z.string().optional(),
  refund_action: z.enum(['refund', 'waive', 'none']).default('none'),
})

export type ReturnFormState = {
  success: boolean
  error?: string
}

export async function returnFob(formData: FormData): Promise<ReturnFormState> {
  const supabase = await createClient()

  const parsed = returnSchema.safeParse({
    assignment_id: formData.get('assignment_id'),
    return_notes: formData.get('return_notes') || undefined,
    refund_action: formData.get('refund_action') || 'none',
  })

  if (!parsed.success) {
    return { success: false, error: 'Invalid input' }
  }

  const { assignment_id, return_notes, refund_action } = parsed.data

  // Load assignment with relations
  const { data: assignment, error: fetchError } = await supabase
    .from('assignments')
    .select('*, fob:fobs(*), member:members(*)')
    .eq('id', assignment_id)
    .is('returned_at', null)
    .single()

  if (fetchError || !assignment) {
    return { success: false, error: 'Assignment not found or already returned' }
  }

  // Get settings
  const { data: settings } = await supabase.from('app_settings').select('*').eq('id', 1).single()
  const autoRefund = settings?.auto_refund_on_return ?? true

  const now = new Date().toISOString()

  // Mark returned
  const { error: updateError } = await supabase
    .from('assignments')
    .update({ returned_at: now, return_notes: return_notes || null })
    .eq('id', assignment_id)

  if (updateError) {
    return { success: false, error: updateError.message }
  }

  // Mark fob available
  await supabase.from('fobs').update({ status: 'available' }).eq('id', assignment.fob_id)

  // Handle deposit
  const member = (assignment.member as any)
  const effectiveAction = refund_action === 'none' && autoRefund ? 'refund' : refund_action

  if (effectiveAction === 'refund' && assignment.deposit_status === 'paid' && assignment.officernd_fee_id) {
    try {
      const fobType = (assignment.fob as any)?.type
      const serial = (assignment.fob as any)?.serial_number
      const refund = await createRefundFee({
        memberId: member.officernd_id,
        amount: assignment.deposit_amount,
        name: fobType === 'remote' ? `Remote Deposit Refund: ${serial}` : `FOB Deposit Refund: ${serial}`,
      })
      await supabase
        .from('assignments')
        .update({ officernd_refund_fee_id: refund.id, deposit_status: 'refunded' })
        .eq('id', assignment_id)
    } catch (err) {
      await supabase.from('audit_log').insert({
        action: 'refund_fee_failed',
        entity_type: 'assignment',
        entity_id: assignment_id,
        metadata: { error: String(err) },
      })
    }
  } else if (effectiveAction === 'waive' || (effectiveAction === 'refund' && assignment.deposit_status !== 'paid')) {
    // Void the original fee if unpaid
    if (assignment.officernd_fee_id) {
      try {
        await voidFee(assignment.officernd_fee_id)
      } catch {
        // Best effort
      }
    }
    await supabase
      .from('assignments')
      .update({ deposit_status: 'waived' })
      .eq('id', assignment_id)
  }

  await supabase.from('audit_log').insert({
    action: 'fob_returned',
    entity_type: 'assignment',
    entity_id: assignment_id,
    metadata: {
      serial_number: (assignment.fob as any)?.serial_number,
      member_id: assignment.member_id,
      refund_action: effectiveAction,
    },
  })

  return { success: true }
}
