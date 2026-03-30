export const dynamic = 'force-dynamic'

// Demo mode has been removed. This endpoint is disabled.
export async function POST() {
  return Response.json(
    { ok: false, error_code: 'demo_disabled', message: 'Demo modu kaldirildi. Gercek API bilgilerinizi girerek baglanin.' },
    { status: 410 }
  )
}
