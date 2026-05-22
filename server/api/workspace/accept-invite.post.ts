import jwt from 'jsonwebtoken'

interface InviteTokenPayload {
  email: string
  role: 'admin' | 'member'
  workspace_id: string
  invited_by: string
  iat: number
  exp: number
}

export default defineEventHandler(async (event) => {
  const config = useRuntimeConfig()
  const body = await readBody<{ token: string; user_id: string }>(event)

  if (!body.token || !body.user_id) {
    throw createError({ statusCode: 400, statusMessage: 'Missing token or user_id' })
  }

  // ── Verify and decode JWT ───────────────────────────────────
  const inviteSecret = config.inviteSecret
  if (!inviteSecret) {
    throw createError({ statusCode: 500, statusMessage: 'Server misconfiguration: invite secret missing.' })
  }

  let payload: InviteTokenPayload
  try {
    payload = jwt.verify(body.token, inviteSecret) as InviteTokenPayload
  } catch (err: any) {
    throw createError({
      statusCode: 400,
      statusMessage: err.name === 'TokenExpiredError'
        ? 'This invitation has expired. Please ask your admin to send a new one.'
        : 'Invalid invite token.',
    })
  }

  // ── Insert member using service-role (bypasses RLS for invite flow) ──
  const { createClient } = await import('@supabase/supabase-js')
  const adminClient = createClient(
    config.public.supabaseUrl,
    config.supabaseServiceRoleKey
  )

  // Check if already a member
  const { data: existing } = await adminClient
    .from('workspace_members')
    .select('id')
    .eq('workspace_id', payload.workspace_id)
    .eq('user_id', body.user_id)
    .single()

  if (existing) {
    // Already a member — just redirect to workspace (idempotent)
    return { success: true, workspace_id: payload.workspace_id, alreadyMember: true }
  }

  // Insert the new member row
  const { error } = await adminClient.from('workspace_members').insert({
    workspace_id: payload.workspace_id,
    user_id: body.user_id,
    role: payload.role,
    invited_by: payload.invited_by,
    joined_at: new Date().toISOString(),
  })

  if (error) {
    console.error('[AcceptInvite] DB error:', error)
    throw createError({ statusCode: 500, statusMessage: 'Failed to join workspace. Please try again.' })
  }

  return { success: true, workspace_id: payload.workspace_id, alreadyMember: false }
})
