import { NextResponse } from 'next/server'

export async function GET() {
  const rows = [
    ['serial_number', 'type', 'status', 'member_name', 'issued_at', 'expected_return_at', 'notes'],
    ['FOB-001', 'fob', 'available', '', '', '', ''],
    ['FOB-002', 'fob', 'assigned', 'Jane Smith', '2026-01-15', '2026-06-30', 'Suite 2 member'],
    ['REM-001', 'remote', 'assigned', 'John Doe', '2026-02-01', '', ''],
    ['FOB-003', 'fob', 'lost', 'Bob Lee', '2025-11-01', '', 'Reported lost March 2026'],
  ]

  const csv = rows.map(r => r.map(cell => `"${cell}"`).join(',')).join('\r\n')

  return new NextResponse(csv, {
    headers: {
      'Content-Type': 'text/csv',
      'Content-Disposition': 'attachment; filename="hexa-fob-template.csv"',
    },
  })
}
