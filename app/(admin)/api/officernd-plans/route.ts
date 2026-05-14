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
      scope: 'flex.billing.charges.read flex.billing.charges.create flex.billing.payments.read flex.billing.payments.create flex.billing.payments.documents.read flex.community.fees.read flex.community.members.read',
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

  // Probe invoice/payment endpoints
  if (searchParams.get('probe')) {
    const memberId = searchParams.get('member')
    const feeId = searchParams.get('fee')
    const empty = JSON.stringify({})

    if (memberId) {
      const body = JSON.stringify({
        date: new Date().toISOString().slice(0, 10),
        location: '5d1bcda0dbd6e40010479eec',
        member: memberId,
        lines: [{ description: 'FOB Deposit: TEST-DEBUG', unitPrice: 1, quantity: 1 }],
      })
      const result = await f(`${API_V2}/payments`, token, { method: 'POST', body })
      return NextResponse.json({ 'POST v2/payments': result })
    }

    const [v2pay, recentPay] = await Promise.all([
      f(`${API_V2}/payments`, token, { method: 'POST', body: empty }),
      f(`${API_V2}/payments`, token),
    ])
    return NextResponse.json({
      'POST v2/payments (empty probe)': v2pay,
      'GET v2/payments (recent)': { status: recentPay.status, count: recentPay.body?.results?.length ?? recentPay.body?.length },
    })
  }

  const id = searchParams.get('id')
  if (id) {
    const fee = await f(`${API_V1}/fees/${id}`, token)
    const memberId = fee.body?.member
    const member = memberId ? await f(`${API_V1}/members/${memberId}`, token) : null
    const teamId = member?.body?.team
    const [memberFees, teamFees] = await Promise.all([
      memberId ? f(`${API_V1}/fees?member=${memberId}`, token) : Promise.resolve(null),
      teamId ? f(`${API_V1}/fees?team=${teamId}`, token) : Promise.resolve(null),
    ])
    return NextResponse.json({
      fee: fee.body,
      member: member?.body ? { _id: member.body._id, name: member.body.name, team: member.body.team } : null,
      fees_by_member: memberFees?.body,
      fees_by_team: teamFees?.body,
    })
  }

  return NextResponse.json({ usage: '?id=<fee_id> or ?probe=1 to test invoice endpoints' })
}
