import { NextResponse } from 'next/server'

const IDENTITY_URL = 'https://identity.officernd.com/oauth/token'
const ORG = process.env.OFFICERND_ORG_SLUG
const API_V1 = `https://app.officernd.com/api/v1/organizations/${ORG}`

async function getToken() {
  const res = await fetch(IDENTITY_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'client_credentials',
      client_id: process.env.OFFICERND_CLIENT_ID!,
      client_secret: process.env.OFFICERND_CLIENT_SECRET!,
      scope: 'flex.community.fees.read flex.community.fees.create flex.community.memberships.create flex.community.memberships.delete',
    }),
  })
  const data = await res.json()
  return data.access_token as string
}

async function f(url: string, token: string) {
  const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } })
  return { status: res.status, body: await res.json() }
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const id = searchParams.get('id')

  const token = await getToken()

  if (id) {
    const [membership, fee] = await Promise.all([
      f(`${API_V1}/memberships/${id}`, token),
      f(`${API_V1}/fees/${id}`, token),
    ])
    return NextResponse.json({ id, v1_membership: membership, v1_fee: fee })
  }

  return NextResponse.json({ error: 'Pass ?id=<officernd_fee_id> to look up a record' })
}
