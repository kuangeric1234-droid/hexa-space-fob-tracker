import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(request: NextRequest) {
  const body = await request.json()
  const { member_id, member_name, email, fob_confirmations, additional_fobs, notes } = body

  if (!member_name?.trim()) {
    return NextResponse.json({ error: 'Name is required' }, { status: 400 })
  }

  // Save audit response
  const { error: responseError } = await supabase.from('fob_audit_responses').insert({
    member_id: member_id || null,
    member_name: member_name.trim(),
    email: email?.trim() || null,
    fob_confirmations: fob_confirmations ?? [],
    additional_fobs: additional_fobs ?? [],
    notes: notes?.trim() || null,
  })

  if (responseError) return NextResponse.json({ error: responseError.message }, { status: 500 })

  // Auto-register fobs in the tracker if we have a valid member
  if (member_id && Array.isArray(fob_confirmations) && fob_confirmations.length > 0) {
    const { data: settings } = await supabase.from('app_settings').select('*').eq('id', 1).single()
    const defaultFobDeposit = settings?.default_fob_deposit ?? 100
    const defaultRemoteDeposit = settings?.default_remote_deposit ?? 200

    for (const entry of fob_confirmations) {
      const serial = entry.serial_number?.toUpperCase().replace(/\s/g, '')
      if (!serial) continue

      // Upsert fob record
      const { data: fob } = await supabase
        .from('fobs')
        .upsert(
          { serial_number: serial, type: entry.type ?? 'fob', status: 'assigned', location: 'hexa' },
          { onConflict: 'serial_number' }
        )
        .select()
        .single()

      if (!fob) continue

      // Ensure status is assigned
      await supabase.from('fobs').update({ status: 'assigned' }).eq('id', fob.id)

      // Only create assignment if none exists for this fob
      const { data: existing } = await supabase
        .from('assignments')
        .select('id')
        .eq('fob_id', fob.id)
        .is('returned_at', null)
        .single()

      if (!existing) {
        await supabase.from('assignments').insert({
          fob_id: fob.id,
          member_id,
          issued_at: new Date().toISOString(),
          deposit_amount: entry.type === 'remote' ? defaultRemoteDeposit : defaultFobDeposit,
          deposit_status: 'pending',
          issue_notes: 'Added via member audit form',
        })
      }
    }

    await supabase.from('audit_log').insert({
      action: 'fob_audit_submitted',
      entity_type: 'member',
      entity_id: member_id,
      metadata: {
        member_name: member_name.trim(),
        fobs_reported: fob_confirmations.length,
      },
    })
  }

  return NextResponse.json({ ok: true })
}
