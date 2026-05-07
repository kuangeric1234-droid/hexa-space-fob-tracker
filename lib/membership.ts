export interface ParsedMembership {
  type: string
  level: string | null
  suite: string | null
}

export function parseMembership(raw: string | null | undefined): ParsedMembership {
  if (!raw) return { type: '—', level: null, suite: null }
  const r = raw.trim()

  // ── Membership type ─────────────────────────────────────────────────────────
  let type = 'Office'
  if (/parking/i.test(r)) type = 'Parking'
  else if (/flexible\s*access/i.test(r)) type = 'Flexi'
  else if (/virtual\s*office/i.test(r) || /^office\s*-\s*vo/i.test(r)) type = 'Virtual office'
  else if (/dedicated\s*desk/i.test(r)) type = 'Dedicated desk'
  else if (/meeting\s*room/i.test(r)) type = 'Meeting room'

  // ── Level ────────────────────────────────────────────────────────────────────
  let level: string | null = null
  const l2 = /^L2\s*-/i.test(r) || /level\s*2/i.test(r)
  const l3 = /level\s*3/i.test(r)
  const l4 = /^L4\s*-/i.test(r) || /level\s*4/i.test(r)
  if (l2) level = '2'
  else if (l3) level = '3'
  else if (l4) level = '4'
  // Offices without an explicit level prefix are Level 4
  else if (type === 'Office') level = '4'

  // ── Suite / unit ─────────────────────────────────────────────────────────────
  let suite: string | null = null

  // Split on " - " and look at the last segment
  const parts = r.split(/\s+-\s+/)
  if (parts.length >= 2) {
    const last = parts[parts.length - 1].trim()

    const suiteMatch = last.match(/suite\s*([\d\s+]+)/i)
    const deskMatch  = last.match(/dedicated\s*desk\s*(\d+)/i)
    const voMatch    = last.match(/VO\s*(\d+)/i)
    const officeMatch = last.match(/office\s*(\d+)/i)
    const parkMatch  = last.match(/^(L\d+)$/i)
    const numMatch   = last.match(/^(\d+)$/)

    if (suiteMatch)   suite = suiteMatch[1].trim().replace(/\s+/g, ' ')
    else if (deskMatch)   suite = `Desk ${deskMatch[1]}`
    else if (voMatch)     suite = `VO${voMatch[1]}`
    else if (officeMatch) suite = officeMatch[1]
    else if (parkMatch)   suite = parkMatch[1].toUpperCase()
    else if (numMatch)    suite = numMatch[1]
    else if (!/^(dedicated desk|flexible access|virtual office|parking|meeting room|office)$/i.test(last)) {
      suite = last
    }
  }

  return { type, level, suite }
}
