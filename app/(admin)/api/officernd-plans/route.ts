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
      scope: 'flex.billing.charges.read flex.billing.charges.create flex.community.fees.read flex.community.memberships.read flex.community.members.read',
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
  const id = searchParams.get('id')

  if (id) {
    const fee = await f(`${API_V1}/fees/${id}`, token)
    const memberId = fee.body?.member
    const [member, memberFees, companyFees] = await Promise.all([
      memberId ? f(`${API_V1}/members/${memberId}`, token) : Promise.resolve(null),
      memberId ? f(`${API_V1}/fees?member=${memberId}`, token) : Promise.resolve(null),
      memberId ? f(`${API_V1}/fees?team=${memberId}`, token) : Promise.resolve(null),
    ])
    const teamId = member?.body?.team
    const teamFees = teamId ? await f(`${API_V1}/fees?team=${teamId}`, token) : null
    return NextResponse.json({
      fee: fee.body,
      member: member?.body ? { _id: member.body._id, name: member.body.name, team: member.body.team, office: member.body.office } : null,
      fees_by_member: memberFees?.body,
      fees_by_team: teamFees?.body,
    })
  }

  return NextResponse.json({ usage: '?id=<fee_id>' })
}
