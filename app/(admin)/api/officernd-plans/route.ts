import { NextResponse } from 'next/server'

const IDENTITY_URL = 'https://identity.officernd.com/oauth/token'
const ORG = process.env.OFFICERND_ORG_SLUG
const API_V1 = `https://app.officernd.com/api/v1/organizations/${ORG}`
const API_V2 = `https://app.officernd.com/api/v2/organizations/${ORG}`

async function getToken(scope: string) {
  const res = await fetch(IDENTITY_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'client_credentials',
      client_id: process.env.OFFICERND_CLIENT_ID!,
      client_secret: process.env.OFFICERND_CLIENT_SECRET!,
      scope,
    }),
  })
  const data = await res.json()
  return data.access_token as string
}

async function tryFetch(url: string, token: string) {
  const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } })
  const body = await res.json()
  return { status: res.status, body }
}

export async function GET() {
  const scopes = [
    'flex.community.fees.read flex.community.fees.create',
    'flex.billing.plans.read',
    'flex.community.members.read',
  ]

  const results: Record<string, any> = {}

  for (const scope of scopes) {
    try {
      const token = await getToken(scope)
      const [v1plans, v2plans, v2feeplans] = await Promise.all([
        tryFetch(`${API_V1}/plans`, token),
        tryFetch(`${API_V2}/plans`, token),
        tryFetch(`${API_V2}/fee-plans`, token),
      ])
      results[scope] = { v1_plans: v1plans, v2_plans: v2plans, v2_fee_plans: v2feeplans }
      break
    } catch (e: any) {
      results[scope] = { error: e.message }
    }
  }

  return NextResponse.json(results)
}
