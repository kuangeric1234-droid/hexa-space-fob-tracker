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

  if (searchParams.get('accounts')) {
    const [v1, v2] = await Promise.all([
      f(`${API_V1}/accounts`, token),
      f(`${API_V2}/accounts`, token),
    ])
    return NextResponse.json({ v1_accounts: v1, v2_accounts: v2 })
  }

  const id = searchParams.get('id')
  if (id) {
    const [membership, fee] = await Promise.all([
      f(`${API_V1}/memberships/${id}`, token),
      f(`${API_V1}/fees/${id}`, token),
    ])
    return NextResponse.json({ id, v1_membership: membership, v1_fee: fee })
  }

  return NextResponse.json({ usage: 'add ?accounts=1 to list revenue accounts, or ?id=<id> to look up a record' })
}
