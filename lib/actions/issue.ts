'use server'

import { createClient } from '@/lib/supabase/server'
import { createFee } from '@/lib/officernd/client'
import { normalizeSerial } from '@/lib/utils'
import { z } from 'zod'
import type { FobType, FobLocation } from '@/types'

const issueSchema = z.object({
  member_id: z.string().uuid(),
  serial_number: z.string().min(1),
  type: z.enum(['fob', 'remote']),
  location: z.enum(['hexa', 'panorama', 'kai', 'other']).default('hexa'),
  expected_return_at: z.string().optional(),
  issue_notes: z.string().optional(),
})

export type IssueFormState = {
  success: boolean
  error?: string
  assignmentId?: string
  depositWarning?: boolean
}

export async function issueFob(formData: FormData): Promise<IssueFormState> {
  const supabase = await createClient()

  const raw = {
    member_id: formData.get('member_id') as string,
    serial_number: formData.get('serial_number') as string,
    type: formData.get('type') as FobType,
    location: (formData.get('location') as FobLocation) ?? 'hexa',
    expected_return_at: (formData.get('expected_return_at') as string) || undefined,
    issue_notes: (formData.get('issue_notes') as string) || undefined,
  }

  const parsed = issueSchema.safeParse(raw)
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? 'Invalid input' }
  }

  const { member_id, serial_number, type, location, expected_return_at, issue_notes } = parsed.data
  const normalizedSerial = normalizeSerial(serial_number)

  // Get settings for deposit amount
  const { data: settings } = await supabase
    .from('app_settings')
    .select('*')
    .eq('id', 1)
    .single()

  const depositAmount = type === 'remote'
    ? (settings?.default_remote_deposit ?? 200)
    : (settings?.default_fob_deposit ?? 100)

  const autoCreateFee = settings?.auto_create_deposit_fee ?? true

  // Upsert fob
  const { data: fob, error: fobError } = await supabase
    .from('fobs')
    .upsert(
      { serial_number: normalizedSerial, type, location, status: 'assigned' },
      { onConflict: 'serial_number' }
    )
    .select()
    .single()

  if (fobError || !fob) {
    return { success: false, error: fobError?.message ?? 'Failed to create fob record' }
  }

  // Update status to assigned if fob already existed
  await supabase.from('fobs').update({ status: 'assigned', location, type }).eq('id', fob.id)

  // Create assignment
  const { data: assignment, error: assignmentError } = await supabase
    .from('assignments')
    .insert({
      fob_id: fob.id,
      member_id,
      issued_at: new Date().toISOString(),
      expected_return_at: expected_return_at || null,
      deposit_amount: depositAmount,
      deposit_currency: 'USD',
      deposit_status: 'pending',
      issue_notes: issue_notes || null,
    })
    .select()
    .single()

  if (assignmentError || !assignment) {
    // Rollback fob status
    await supabase.from('fobs').update({ status: 'available' }).eq('id', fob.id)
    return {
      success: false,
      error: assignmentError?.message?.includes('assignments_fob_open_idx')
        ? 'This fob is already assigned to someone.'
        : (assignmentError?.message ?? 'Failed to create assignment'),
    }
  }

  // Get member's OfficeRnD ID
  const { data: member } = await supabase
    .from('members')
    .select('officernd_id, name')
    .eq('id', member_id)
    .single()

  let depositWarning = false

  if (autoCreateFee && member?.officernd_id) {
    try {
      const fee = await createFee({
        memberId: member.officernd_id,
        amount: depositAmount,
        description: type === 'remote' ? `Remote Deposit: ${normalizedSerial}` : `FOB Deposit: ${normalizedSerial}`,
        currency: 'USD',
      })

      await supabase
        .from('assignments')
        .update({ officernd_fee_id: fee.id })
        .eq('id', assignment.id)
    } catch (err) {
      // Log failure but don't block
      await supabase.from('assignments').update({ deposit_status: 'failed' }).eq('id', assignment.id)
      await supabase.from('audit_log').insert({
        action: 'deposit_fee_failed',
        entity_type: 'assignment',
        entity_id: assignment.id,
        metadata: { error: String(err) },
      })
      depositWarning = true
    }
  }

  await supabase.from('audit_log').insert({
    action: 'fob_issued',
    entity_type: 'assignment',
    entity_id: assignment.id,
    metadata: {
      serial_number: normalizedSerial,
      type,
      member_id,
      deposit_amount: depositAmount,
    },
  })

  return { success: true, assignmentId: assignment.id, depositWarning }
}
