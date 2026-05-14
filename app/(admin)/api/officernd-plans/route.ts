import { NextResponse } from 'next/server'

const API_BASE = `https://app.officernd.com/api/v2/organizations/${process.env.OFFICERND_ORG_SLUG}`
const IDENTITY_URL = 'https://identity.officernd.com/oauth/token'

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
  return data.access_token
}

export async function GET() {
  const token = await getToken()
  const res = await fetch(`${API_BASE}/plans`, {
    headers: { Authorization: `Bearer ${token}` },
  })
  const data = await res.json()
  const plans = Array.isArray(data) ? data : (data.results ?? data.data ?? data)
  return NextResponse.json(
    plans.map((p: any) => ({ id: p._id, name: p.name, type: p.type }))
  )
}
