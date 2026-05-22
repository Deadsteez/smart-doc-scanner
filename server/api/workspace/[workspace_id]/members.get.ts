import { getSupabase } from '~/services/supabaseClient'

export default defineEventHandler(async (event) => {
  const config = useRuntimeConfig()
  const workspace_id = getRouterParam(event, 'workspace_id')

  if (!workspace_id) {
    throw createError({ statusCode: 400, statusMessage: 'Workspace ID is required' })
  }

  const authHeader = getHeader(event, 'Authorization')
  if (!authHeader) {
    throw createError({ statusCode: 401, statusMessage: 'Unauthorized' })
  }

  const { createClient } = await import('@supabase/supabase-js')
  
  const adminClient = createClient(
    config.public.supabaseUrl,
    config.supabaseServiceRoleKey
  )
  
  const userToken = authHeader.replace('Bearer ', '')
  const { data: { user }, error: userErr } = await adminClient.auth.getUser(userToken)
  
  if (userErr || !user) {
    throw createError({ statusCode: 401, statusMessage: 'Invalid session' })
  }

 
  const { data: memberCheck } = await adminClient
    .from('workspace_members')
    .select('id')
    .eq('workspace_id', workspace_id)
    .eq('user_id', user.id)
    .single()
    
  const { data: workspace } = await adminClient
    .from('workspaces')
    .select('owner_id')
    .eq('id', workspace_id)
    .single()

  if (!memberCheck && workspace?.owner_id !== user.id) {
    throw createError({ statusCode: 403, statusMessage: 'Forbidden' })
  }

  
  const { data: members, error: membersErr } = await adminClient
    .from('workspace_members')
    .select('*')
    .eq('workspace_id', workspace_id)
    .order('joined_at', { ascending: true })

  if (membersErr) {
    throw createError({ statusCode: 500, statusMessage: membersErr.message })
  }

  const { data: { users }, error: authErr } = await adminClient.auth.admin.listUsers()
  
  if (authErr) {
    console.error('Failed to list users', authErr)
    
    return members ?? []
  }

  const userMap = new Map(users.map(u => [u.id, u.email]))

  const membersWithEmails = (members ?? []).map(m => ({
    ...m,
    email: userMap.get(m.user_id) ?? null
  }))

  return membersWithEmails
})