export type MemberStatus = 'active' | 'cancelled' | 'paused' | 'contact'
export type FobType = 'fob' | 'remote'
export type FobLocation = 'hexa' | 'panorama' | 'kai' | 'other'
export type FobStatus = 'available' | 'assigned' | 'lost' | 'deactivated' | 'retired'
export type DepositStatus = 'pending' | 'paid' | 'refunded' | 'waived' | 'failed'

export interface Member {
  id: string
  officernd_id: string
  name: string
  company: string | null
  email: string | null
  suite: string | null
  parking: string | null
  status: MemberStatus
  last_synced_at: string | null
}

export interface Fob {
  id: string
  serial_number: string
  type: FobType
  location: FobLocation
  status: FobStatus
  notes: string | null
  created_at: string
}

export interface Assignment {
  id: string
  fob_id: string
  member_id: string
  issued_at: string
  expected_return_at: string | null
  returned_at: string | null
  deposit_amount: number
  deposit_currency: string
  officernd_fee_id: string | null
  officernd_refund_fee_id: string | null
  deposit_status: DepositStatus
  issue_notes: string | null
  return_notes: string | null
  created_at: string
}

export interface AssignmentWithRelations extends Assignment {
  fob: Fob
  member: Member
}

export interface AuditLog {
  id: string
  action: string
  entity_type: string | null
  entity_id: string | null
  metadata: Record<string, unknown> | null
  created_at: string
}

export interface AppSettings {
  id: number
  default_fob_deposit: number
  default_remote_deposit: number
  notification_email: string | null
  auto_create_deposit_fee: boolean
  auto_refund_on_return: boolean
}

export interface DashboardStats {
  in_circulation: number
  available: number
  overdue: number
  unpaid_deposits: number
}

export interface NeedsAttentionItem {
  type: 'overdue' | 'cancelled_with_fob' | 'unpaid_deposit'
  assignment: AssignmentWithRelations
  days?: number
}
