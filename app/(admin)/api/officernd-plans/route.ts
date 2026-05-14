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
      scope: 'flex.billing.charges.read flex.billing.charges.create flex.community.fees.read flex.community.memberships.read',
    }),
  })
  const data = await res.json()
  return data.access_token as string
}

async function f(url: string, token: string, options?: RequestInit) {
  const res = await fetch(url, {
    ...options,
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', ...(options?.headers ?? {}) },
  })
  return { status: res.status, body: await res.json() }
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const token = await getToken()

  // Probe charges endpoints with an empty POST to see what fields are required
  if (searchParams.get('probe')) {
    const body = JSON.stringify({})
    const results = await Promise.all([
      f(`${API_V2}/charges`, token, { method: 'POST', body }),
      f(`${API_V2}/billing/charges`, token, { method: 'POST', body }),
      f(`${API_V1}/charges`, token, { method: 'POST', body }),
      f(`${API_V2}/charges`, token),       // GET list
      f(`${API_V2}/billing/charges`, token), // GET list
    ])
    return NextResponse.json({
      'POST v2/charges': results[0],
      'POST v2/billing/charges': results[1],
      'POST v1/charges': results[2],
      'GET v2/charges': results[3],
      'GET v2/billing/charges': results[4],
    })
  }

  const id = searchParams.get('id')
  if (id) {
    const [membership, fee] = await Promise.all([
      f(`${API_V1}/memberships/${id}`, token),
      f(`${API_V1}/fees/${id}`, token),
    ])
    return NextResponse.json({ id, v1_membership: membership, v1_fee: fee })
  }

  return NextResponse.json({ usage: 'add ?probe=1 to test charge endpoints, or ?id=<id> to look up a record' })
}
