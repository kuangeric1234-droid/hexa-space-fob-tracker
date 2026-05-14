import { NextResponse } from 'next/server'

const IDENTITY_URL = 'https://identity.officernd.com/oauth/token'
const ORG = process.env.OFFICERND_ORG_SLUG
const API_V1 = `https://app.officernd.com/api/v1/organizations/${ORG}`
const API_V2 = `https://app.officernd.com/api/v2/organizations/${ORG}`

async function getToken() {
  const res = await fetch(IDENTITY_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'client_credentials',
      client_id: process.env.OFFICERND_CLIENT_ID!,
      client_secret: process.env.OFFICERND_CLIENT_SECRET!,
      scope: 'flex.community.fees.read flex.community.fees.create',
    }),
  })
  const data = await res.json()
  return data.access_token as string
}

async function f(url: string, token: string, options?: RequestInit) {
  const res = await fetch(url, { ...options, headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', ...(options?.headers ?? {}) } })
  return { status: res.status, body: await res.json() }
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const feeId = searchParams.get('fee_id')
  const memberId = searchParams.get('member_id')

  const token = await getToken()

  if (feeId) {
    const [v1, v2] = await Promise.all([
      f(`${API_V1}/fees/${feeId}`, token),
      f(`${API_V2}/fees/${feeId}`, token),
    ])
    return NextResponse.json({ fee_id: feeId, v1, v2 })
  }

  // List recent fees — optionally filtered by member
  const memberQ = memberId ? `&member=${memberId}` : ''
  const [v1fees, v2fees, v1memberships] = await Promise.all([
    f(`${API_V1}/fees?limit=10${memberQ}`, token),
    f(`${API_V2}/fees?limit=10${memberQ}`, token),
    memberId ? f(`${API_V1}/memberships?member=${memberId}&limit=10`, token) : Promise.resolve(null),
  ])
  return NextResponse.json({ v1_fees: v1fees, v2_fees: v2fees, v1_memberships: v1memberships })
}
