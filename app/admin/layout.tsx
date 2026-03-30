import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

export default async function AdminRootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const supabase = createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()

  if (authError || !user) {
    redirect('/auth?next=/admin')
  }

  try {
    const adminClient = createAdminClient()
    const { data, error } = await adminClient
      .from('profiles')
      .select('plan')
      .eq('id', user.id)
      .single()

    if (error) {
      // profiles tablosuna erişilemedi — redirect
      redirect('/dashboard')
    }

    const plan = (data as Record<string, unknown>)?.plan as string
    if (plan !== 'admin') {
      redirect('/dashboard')
    }
  } catch {
    redirect('/dashboard')
  }

  return <>{children}</>
}
