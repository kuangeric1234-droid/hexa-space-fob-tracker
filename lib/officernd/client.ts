const IDENTITY_URL = 'https://identity.officernd.com/oauth/token'
const API_BASE = `https://app.officernd.com/api/v2/organizations/${process.env.OFFICERND_ORG_SLUG}`
const API_BASE_V1 = `https://app.officernd.com/api/v1/organizations/${process.env.OFFICERND_ORG_SLUG}`

interface TokenCache {
  access_token: string
  expires_at: number
}

let tokenCache: TokenCache | null = null

async function getToken(): Promise<string> {
  if (tokenCache && Date.now() < tokenCache.expires_at - 30_000) {
    return tokenCache.access_token
  }

  const res = await fetch(IDENTITY_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'client_credentials',
      client_id: process.env.OFFICERND_CLIENT_ID!,
      client_secret: process.env.OFFICERND_CLIENT_SECRET!,
      scope: [
        'flex.community.members.read',
        'flex.community.companies.read',
        'flex.space.resources.read',
        'flex.community.fees.create',
        'flex.community.fees.read',
        'flex.community.memberships.read',
        'flex.community.memberships.create',
        'flex.community.memberships.delete',
        'flex.billing.charges.read',
        'flex.billing.charges.create',
      ].join(' '),
    }),
  })

  if (!res.ok) {
    const body = await res.text()
    throw new Error(`OfficeRnD auth failed: ${res.status} ${body}`)
  }

  const data = await res.json()
  tokenCache = {
    access_token: data.access_token,
    expires_at: Date.now() + data.expires_in * 1000,
  }

  return tokenCache.access_token
}

async function apiFetch(path: string, options: RequestInit = {}, v1 = false) {
  const token = await getToken()
  const base = v1 ? API_BASE_V1 : API_BASE
  const res = await fetch(`${base}${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      ...options.headers,
    },
  })

  if (!res.ok) {
    const body = await res.text()
    throw new Error(`OfficeRnD API error ${res.status} on ${path}: ${body}`)
  }

  return res.json()
}

export interface OfficerndMember {
  _id: string
  name: string
  email?: string
  status: string
  calculatedStatus?: string  // v1: the real current status
  // v1 fields
  office?: string   // location/office ID
  team?: string     // company/team ID
  // v2 fields (IDs or objects)
  location?: string | { _id: string; name: string }
  company?: string | { _id: string; name: string }
}

export interface OfficerndCompany {
  _id: string
  name: string
}

export interface OfficerndResource {
  _id: string
  name: string
  type?: string
}

export async function fetchAllCompanies(): Promise<OfficerndCompany[]> {
  const data = await apiFetch('/companies')
  return Array.isArray(data) ? data : (data.results ?? data.data ?? [])
}

// Resolves company names for all unique team IDs found in a member list.
// Starts with the first-page company list and fetches any missing ones individually.
export async function resolveAllCompanies(members: OfficerndMember[]): Promise<Map<string, string>> {
  const firstPage = await fetchAllCompanies()
  const map = new Map<string, string>(firstPage.map((c) => [c._id, c.name]))

  const missingIds = [...new Set(
    members
      .map((m) => m.team ?? (typeof m.company === 'string' ? m.company : m.company?._id))
      .filter((id): id is string => !!id && !map.has(id))
  )]

  // Fetch missing companies in parallel batches of 10
  const BATCH = 10
  for (let i = 0; i < missingIds.length; i += BATCH) {
    const batch = missingIds.slice(i, i + BATCH)
    await Promise.all(
      batch.map(async (id) => {
        try {
          const data = await apiFetch(`/companies/${id}`)
          if (data?._id && data?.name) map.set(data._id, data.name)
        } catch {
          // Not found — skip
        }
      })
    )
  }

  return map
}

export async function fetchAllResources(): Promise<OfficerndResource[]> {
  const data = await apiFetch('/resources')
  return Array.isArray(data) ? data : (data.results ?? data.data ?? [])
}

export interface OfficerndMembership {
  _id: string
  name: string
  member?: string | null
  team?: string | null
  status: string
  calculatedStatus?: string
}

export async function fetchActiveMemberships(): Promise<OfficerndMembership[]> {
  const data = await apiFetch('/memberships?status=active', {}, true)
  return Array.isArray(data) ? data : (data.results ?? data.data ?? [])
}

function isParking(name: string) {
  return /parking/i.test(name)
}

function suitePriority(name: string) {
  const n = name.toLowerCase()
  if (n.includes('suite') || n.includes('office') || n.includes('dedicated')) return 2
  if (n.includes('flexible') || n.includes('virtual')) return 1
  return 0
}

// Returns maps for suite and parking, keyed by member ID or team ID
export function buildSuiteMaps(memberships: OfficerndMembership[]): {
  memberSuiteMap: Map<string, string>
  teamSuiteMap: Map<string, string>
  memberParkingMap: Map<string, string>
  teamParkingMap: Map<string, string>
} {
  const memberSuiteMap   = new Map<string, string>()
  const teamSuiteMap     = new Map<string, string>()
  const memberParkingMap = new Map<string, string>()
  const teamParkingMap   = new Map<string, string>()

  for (const m of memberships) {
    const name = m.name
    const parking = isParking(name)

    if (m.member) {
      if (parking) {
        memberParkingMap.set(m.member, name)
      } else {
        const existing = memberSuiteMap.get(m.member)
        if (!existing || suitePriority(name) > suitePriority(existing)) {
          memberSuiteMap.set(m.member, name)
        }
      }
    } else if (m.team) {
      if (parking) {
        teamParkingMap.set(m.team, name)
      } else {
        const existing = teamSuiteMap.get(m.team)
        if (!existing || suitePriority(name) > suitePriority(existing)) {
          teamSuiteMap.set(m.team, name)
        }
      }
    }
  }

  return { memberSuiteMap, teamSuiteMap, memberParkingMap, teamParkingMap }
}

export async function fetchAllMembers(): Promise<OfficerndMember[]> {
  // v1 returns all members in one array; v2 caps at 50 with broken cursor
  const data = await apiFetch('/members', {}, true)
  if (Array.isArray(data)) return data
  if (Array.isArray(data.results)) return data.results
  return []
}

export interface CreateFeePayload {
  memberId: string
  amount: number
  name: string
}

const FOB_DEPOSIT_PLAN_ID = '6a051a414427d505a37e50c7'
const LOCATION_ID = '5d1bcda0dbd6e40010479eec'

export async function createFee(payload: CreateFeePayload): Promise<{ id: string }> {
  const member = await apiFetch(`/members/${payload.memberId}`, {}, true)
  const teamId: string | undefined = member?.team

  const body = {
    member: payload.memberId,
    ...(teamId && { team: teamId }),
    name: payload.name,
    price: payload.amount,
    issueDate: new Date().toISOString(),
    location: LOCATION_ID,
    plan: FOB_DEPOSIT_PLAN_ID,
  }

  const data = await apiFetch('/fees', { method: 'POST', body: JSON.stringify(body) })
  const id = data._id ?? data.id
  if (!id) throw new Error(`OfficeRnD fee created but no ID in response: ${JSON.stringify(data)}`)

  // Patch the team field after creation so it appears in company billing
  if (teamId) {
    try {
      await apiFetch(`/fees/${id}`, { method: 'PATCH', body: JSON.stringify({ team: teamId }) }, true)
    } catch {
      // non-fatal — fee still exists, just may not show in team tab
    }
  }

  return { id }
}

export async function createRefundFee(payload: CreateFeePayload): Promise<{ id: string }> {
  let teamId: string | undefined
  try {
    const member = await apiFetch(`/members/${payload.memberId}`, {}, true)
    teamId = member?.team
  } catch {
    // proceed without team if lookup fails
  }

  const data = await apiFetch('/fees', {
    method: 'POST',
    body: JSON.stringify({
      member: payload.memberId,
      ...(teamId && { team: teamId }),
      name: payload.name,
      price: -Math.abs(payload.amount),
      issueDate: new Date().toISOString(),
      location: LOCATION_ID,
      plan: FOB_DEPOSIT_PLAN_ID,
      isPersonal: true,
    }),
  })
  const id = data._id ?? data.id
  if (!id) throw new Error(`OfficeRnD refund fee created but no ID in response: ${JSON.stringify(data)}`)
  return { id }
}

export async function getFeeStatus(feeId: string): Promise<string> {
  const data = await apiFetch(`/fees/${feeId}`, {}, true)
  return data.invoice?.status ?? data.status ?? 'unknown'
}

export async function voidFee(feeId: string): Promise<void> {
  await apiFetch(`/fees/${feeId}`, { method: 'DELETE' })
}
