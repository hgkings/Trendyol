import { redirect } from 'next/navigation'
import { createClient, createAdminClient } from '@/lib/supabase-server-client'

export default async function AdminRootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect('/auth?next=/admin')
  }

  // Admin client ile RLS bypass ederek plan kontrolü yap
  const adminClient = createAdminClient()
  const { data: profile } = await adminClient
    .from('profiles')
    .select('plan')
    .eq('id', user.id)
    .single()

  if (profile?.plan !== 'admin') {
    redirect('/dashboard')
  }

  return <>{children}</>
}
