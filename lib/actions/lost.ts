'use server'

import { createClient } from '@/lib/supabase/server'

export async function markFobLost(assignmentId: string, notes?: string): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient()

  const { data: assignment, error: fetchError } = await supabase
    .from('assignments')
    .select('*, fob:fobs(*)')
    .eq('id', assignmentId)
    .is('returned_at', null)
    .single()

  if (fetchError || !assignment) {
    return { success: false, error: 'Assignment not found' }
  }

  const { error: fobError } = await supabase
    .from('fobs')
    .update({ status: 'lost' })
    .eq('id', assignment.fob_id)

  if (fobError) return { success: false, error: fobError.message }

  // Leave assignment open — deposit stays pending/unpaid
  if (notes) {
    await supabase
      .from('assignments')
      .update({ issue_notes: [assignment.issue_notes, `LOST: ${notes}`].filter(Boolean).join(' | ') })
      .eq('id', assignmentId)
  }

  await supabase.from('audit_log').insert({
    action: 'fob_lost',
    entity_type: 'assignment',
    entity_id: assignmentId,
    metadata: {
      serial_number: (assignment.fob as any)?.serial_number,
      member_id: assignment.member_id,
      notes: notes ?? null,
    },
  })

  return { success: true }
}
