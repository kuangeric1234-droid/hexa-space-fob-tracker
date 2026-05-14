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

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const feeId = searchParams.get('fee_id')

  const token = await getToken()

  if (feeId) {
    const [v1, v2] = await Promise.all([
      fetch(`${API_V1}/fees/${feeId}`, { headers: { Authorization: `Bearer ${token}` } }).then(r => r.json()),
      fetch(`${API_V2}/fees/${feeId}`, { headers: { Authorization: `Bearer ${token}` } }).then(r => r.json()),
    ])
    return NextResponse.json({ fee_id: feeId, v1, v2 })
  }

  // List recent fees
  const [v1fees, v2fees] = await Promise.all([
    fetch(`${API_V1}/fees?limit=5`, { headers: { Authorization: `Bearer ${token}` } }).then(r => r.json()),
    fetch(`${API_V2}/fees?limit=5`, { headers: { Authorization: `Bearer ${token}` } }).then(r => r.json()),
  ])
  return NextResponse.json({ v1_recent_fees: v1fees, v2_recent_fees: v2fees })
}
