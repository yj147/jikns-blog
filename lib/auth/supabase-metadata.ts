import { createServiceRoleClient } from "@/lib/supabase"

export type SupabaseServiceRoleClient = ReturnType<typeof createServiceRoleClient>

export async function mergeSupabaseUserMetadata(
  client: SupabaseServiceRoleClient,
  userId: string,
  patch: Record<string, unknown>
) {
  const { data, error } = await client.auth.admin.getUserById(userId)

  if (error) {
    throw new Error(`Supabase user fetch failed: ${error.message}`)
  }

  const authUser = data.user

  if (!authUser) {
    throw new Error(`Supabase user not found: ${userId}`)
  }

  const currentMetadata = authUser.user_metadata ?? {}
  const { error: updateError } = await client.auth.admin.updateUserById(userId, {
    user_metadata: { ...currentMetadata, ...patch },
  })

  if (updateError) {
    throw new Error(`Supabase user metadata update failed: ${updateError.message}`)
  }
}
