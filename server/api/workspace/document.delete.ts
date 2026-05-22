export default defineEventHandler(async (event) => {
  const config = useRuntimeConfig()
  const { document_id, workspace_id } = await readBody<{ document_id: string; workspace_id: string }>(event)

  if (!document_id || !workspace_id) {
    throw createError({ statusCode: 400, statusMessage: 'Missing document_id or workspace_id' })
  }

  const authHeader = getHeader(event, 'Authorization')
  if (!authHeader) {
    throw createError({ statusCode: 401, statusMessage: 'Unauthorized' })
  }

  const { createClient } = await import('@supabase/supabase-js')
  const adminClient = createClient(config.public.supabaseUrl, config.supabaseServiceRoleKey)

  const userToken = authHeader.replace('Bearer ', '')
  const { data: { user }, error: userErr } = await adminClient.auth.getUser(userToken)
  if (userErr || !user) {
    throw createError({ statusCode: 401, statusMessage: 'Invalid session' })
  }

  const { data: doc } = await adminClient
    .from('documents')
    .select('user_id, workspace_id')
    .eq('id', document_id)
    .single()

  if (!doc) {
    throw createError({ statusCode: 404, statusMessage: 'Document not found' })
  }

  const isOwner = doc.user_id === user.id

  const { data: member } = await adminClient
    .from('workspace_members')
    .select('role')
    .eq('workspace_id', workspace_id)
    .eq('user_id', user.id)
    .single()

  const { data: workspace } = await adminClient
    .from('workspaces')
    .select('owner_id')
    .eq('id', workspace_id)
    .single()

  const isWorkspaceAdmin = member?.role === 'admin' || workspace?.owner_id === user.id

  if (!isOwner && !isWorkspaceAdmin) {
    throw createError({ statusCode: 403, statusMessage: 'Only the document owner or a workspace admin can delete this document.' })
  }

  const { error: deleteErr } = await adminClient
    .from('documents')
    .delete()
    .eq('id', document_id)

  if (deleteErr) {
    throw createError({ statusCode: 500, statusMessage: deleteErr.message })
  }

  return { success: true }
})
