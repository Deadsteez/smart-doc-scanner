import jwt from 'jsonwebtoken'
import { Resend } from 'resend'
import { getSupabase } from '~/services/supabaseClient'
import type { InviteMemberPayload } from '~/types/workspace'

export default defineEventHandler(async (event) => {
  const config = useRuntimeConfig()
  const body = await readBody<InviteMemberPayload>(event)

  // ── Validate input ──────────────────────────────────────────
  const { email, role, workspace_id } = body

  if (!email || !role || !workspace_id) {
    throw createError({ statusCode: 400, statusMessage: 'Missing required fields: email, role, workspace_id' })
  }

  if (!['admin', 'member'].includes(role)) {
    throw createError({ statusCode: 400, statusMessage: 'Invalid role. Must be "admin" or "member".' })
  }

  // ── Verify the caller is an admin or owner of this workspace ─────────
  // We use the service-role key server-side to bypass RLS for this check
  const { createClient } = await import('@supabase/supabase-js')
  const adminClient = createClient(
    config.public.supabaseUrl,
    config.supabaseServiceRoleKey
  )

  const authHeader = getHeader(event, 'Authorization')
  if (!authHeader) {
    throw createError({ statusCode: 401, statusMessage: 'Unauthorized' })
  }

  const userToken = authHeader.replace('Bearer ', '')
  const { data: { user }, error: userErr } = await adminClient.auth.getUser(userToken)
  if (userErr || !user) {
    throw createError({ statusCode: 401, statusMessage: 'Invalid session' })
  }

  // ── Fetch workspace details (name and owner) ──────────────────────
  const { data: workspace } = await adminClient
    .from('workspaces')
    .select('name, owner_id')
    .eq('id', workspace_id)
    .single()

  const workspaceName = workspace?.name ?? 'a SmartDoc Workspace'
  const isOwner = workspace?.owner_id === user.id

  const { data: callerMember } = await adminClient
    .from('workspace_members')
    .select('role')
    .eq('workspace_id', workspace_id)
    .eq('user_id', user.id)
    .single()

  if (!isOwner && callerMember?.role !== 'admin') {
    throw createError({ statusCode: 403, statusMessage: 'Only workspace admins can invite members.' })
  }

  // ── Sign JWT invite token (72h expiry) ───────────────────────
  const inviteSecret = config.inviteSecret
  if (!inviteSecret) {
    throw createError({ statusCode: 500, statusMessage: 'Invite secret not configured.' })
  }

  const token = jwt.sign(
    { email, role, workspace_id, invited_by: user.id },
    inviteSecret,
    { expiresIn: '72h' }
  )

  const siteUrl = config.public.siteUrl ?? 'http://localhost:3000'
  const inviteUrl = `${siteUrl}/invite?token=${token}`

  // ── Send invite email via Resend ────────────────────────────
  const resendApiKey = config.resendApiKey
  if (!resendApiKey) {
    // Return the invite URL so the admin can share it manually during development
    console.warn('[Invite] RESEND_API_KEY not set. Returning invite URL directly.')
    return { success: true, inviteUrl, emailSent: false }
  }

  const resend = new Resend(resendApiKey)
  const { error: emailErr } = await resend.emails.send({
    from: 'SmartDoc Scanner <onboarding@resend.dev>',
    to: email,
    subject: `You've been invited to ${workspaceName} on SmartDoc Scanner`,
    html: `
      <div style="font-family: Inter, sans-serif; max-width: 560px; margin: 0 auto; padding: 32px; background: #0f172a; color: #e2e8f0; border-radius: 16px;">
        <h1 style="font-size: 22px; font-weight: 700; color: #f8fafc; margin-bottom: 8px;">You've been invited!</h1>
        <p style="color: #94a3b8; margin-bottom: 24px;">
          You've been invited to join <strong style="color: #38bdf8;">${workspaceName}</strong> on SmartDoc Scanner as a <strong>${role}</strong>.
        </p>
        <a href="${inviteUrl}" style="
          display: inline-block;
          background: linear-gradient(135deg, #0284c7, #0ea5e9);
          color: white;
          text-decoration: none;
          padding: 12px 28px;
          border-radius: 10px;
          font-weight: 600;
          font-size: 15px;
          margin-bottom: 24px;
        ">Accept Invitation</a>
        <p style="color: #64748b; font-size: 13px;">
          This link expires in 72 hours. If you didn't expect this invitation, you can safely ignore this email.
        </p>
      </div>
    `,
  })

  if (emailErr) {
    console.error('[Invite] Email send failed:', emailErr)
    // Still return the invite URL as fallback
    return { success: true, inviteUrl, emailSent: false, emailError: emailErr.message }
  }

  return { success: true, emailSent: true }
})
