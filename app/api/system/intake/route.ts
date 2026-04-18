// SQL migration note:
// ALTER TABLE dockets ADD COLUMN IF NOT EXISTS additional_info JSONB;

import { Resend } from 'resend'

import { fetchJPYtoCAD } from '@/lib/exchangeRate'
import { createServerClient } from '@/lib/supabase/server'

type IntakePayload = {
  customer_first_name?: string
  customer_last_name?: string
  customer_email?: string
  customer_phone?: string
  vehicle_year?: string
  vehicle_make?: string
  vehicle_model?: string
  budget?: string
  budget_bracket?: string
  destination_city?: string
  destination_province?: string
  vehicle_type?: string
  duty_type?: string
  timeline?: string
  additional_notes?: string
  selected_path?: string
  selected_private_dealer_option?: number | null
  desired_mileage?: string
  intended_use?: string
  who_for?: string
  right_hand_drive?: string
  ready_to_purchase?: string
  imported_before?: string
  decision_factor?: string
  how_heard?: string
  [key: string]: unknown
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function formDataToObject(formData: FormData): IntakePayload {
  const object: IntakePayload = {}

  for (const [key, value] of formData.entries()) {
    object[key] = typeof value === 'string' ? value : value.name
  }

  return object
}

function parseUrlEncoded(rawText: string): IntakePayload {
  const params = new URLSearchParams(rawText)
  const object: IntakePayload = {}

  for (const [key, value] of params.entries()) {
    object[key] = value
  }

  return object
}

function extractPayload(body: unknown): IntakePayload {
  if (!isRecord(body)) {
    return {}
  }

  const wrappedPayload = body.payload
  if (isRecord(wrappedPayload)) {
    return wrappedPayload as IntakePayload
  }

  const wrappedData = body.data
  if (isRecord(wrappedData)) {
    return wrappedData as IntakePayload
  }

  return body as IntakePayload
}

async function parseIntakeBody(request: Request): Promise<unknown> {
  const contentType = request.headers.get('content-type')?.toLowerCase() ?? ''

  if (contentType.includes('application/json')) {
    const text = await request.text()
    const trimmedText = text.trim()

    if (!trimmedText) {
      return {}
    }

    try {
      return JSON.parse(trimmedText)
    } catch {
      return parseUrlEncoded(trimmedText)
    }
  }

  if (
    contentType.includes('application/x-www-form-urlencoded') ||
    contentType.includes('multipart/form-data')
  ) {
    const formData = await request.formData()
    return formDataToObject(formData)
  }

  const text = await request.text()
  const trimmedText = text.trim()

  if (!trimmedText) {
    return {}
  }

  try {
    return JSON.parse(trimmedText)
  } catch {
    return parseUrlEncoded(trimmedText)
  }
}

function toOptionalNumber(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value
  }

  if (typeof value === 'string') {
    const parsed = Number(value)
    return Number.isFinite(parsed) ? parsed : null
  }

  return null
}

function toOptionalString(value: unknown): string | null {
  if (typeof value !== 'string') {
    return null
  }

  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : null
}

function toAdditionalInfoValue(value: unknown): string | number | boolean | null {
  if (typeof value === 'string') {
    const trimmed = value.trim()
    return trimmed.length > 0 ? trimmed : null
  }

  if (typeof value === 'number' || typeof value === 'boolean') {
    return value
  }

  return null
}

function buildAdditionalInfo(payload: IntakePayload): Record<string, string | number | boolean> | null {
  const entries: Array<[string, string | number | boolean | null]> = [
    ['mileage', toAdditionalInfoValue(payload.desired_mileage)],
    ['intended_use', toAdditionalInfoValue(payload.intended_use)],
    ['who_for', toAdditionalInfoValue(payload.who_for)],
    ['right_hand_drive', toAdditionalInfoValue(payload.right_hand_drive)],
    ['ready_to_purchase', toAdditionalInfoValue(payload.ready_to_purchase)],
    ['imported_before', toAdditionalInfoValue(payload.imported_before)],
    ['decision_factor', toAdditionalInfoValue(payload.decision_factor)],
    ['how_heard', toAdditionalInfoValue(payload.how_heard)],
  ]

  const additionalInfo = Object.fromEntries(
    entries.filter(([, value]) => value !== null)
  ) as Record<string, string | number | boolean>

  return Object.keys(additionalInfo).length > 0 ? additionalInfo : null
}

async function hasAdditionalInfoColumn(
  supabase: ReturnType<typeof createServerClient>
): Promise<boolean> {
  const { error } = await supabase.from('dockets').select('additional_info').limit(1)

  if (!error) {
    return true
  }

  if (
    typeof error.message === 'string' &&
    error.message.toLowerCase().includes('additional_info')
  ) {
    return false
  }

  return false
}

export async function POST(request: Request) {
  try {
    const body = await parseIntakeBody(request)
    console.log('[Intake] Received payload:', JSON.stringify(body))
    const payload = extractPayload(body)
    const customerEmail = toOptionalString(payload.customer_email)

    if (!customerEmail) {
      return Response.json(
        { success: false, error: 'Missing required fields', missingFields: ['customer_email'] },
        { status: 400 }
      )
    }

    const exchange = await fetchJPYtoCAD()
    const supabase = createServerClient()
    const shouldStoreAdditionalInfo = await hasAdditionalInfoColumn(supabase)
    const rawDestinationCity = toOptionalString(payload.destination_city)
    const providedDestinationProvince = toOptionalString(payload.destination_province)
    let destinationCity = rawDestinationCity
    let destinationProvince = providedDestinationProvince

    if (!destinationProvince && rawDestinationCity?.includes(',')) {
      const [cityPart, provincePart] = rawDestinationCity.split(',', 2).map((part) => part.trim())
      destinationCity = cityPart || null
      destinationProvince = provincePart || null
    }

    const additionalInfo = buildAdditionalInfo(payload)

    const docketInsert = {
      status: 'new' as const,
      customer_first_name: toOptionalString(payload.customer_first_name),
      customer_last_name: toOptionalString(payload.customer_last_name),
      customer_email: customerEmail,
      customer_phone: toOptionalString(payload.customer_phone),
      vehicle_year: toOptionalString(payload.vehicle_year),
      vehicle_make: toOptionalString(payload.vehicle_make),
      vehicle_model: toOptionalString(payload.vehicle_model),
      budget_bracket: toOptionalString(payload.budget_bracket ?? payload.budget),
      destination_city: destinationCity,
      destination_province: destinationProvince,
      vehicle_type: toOptionalString(payload.vehicle_type),
      duty_type: toOptionalString(payload.duty_type),
      timeline: toOptionalString(payload.timeline),
      additional_notes: toOptionalString(payload.additional_notes),
      selected_path: toOptionalString(payload.selected_path),
      selected_private_dealer_option: toOptionalNumber(payload.selected_private_dealer_option),
      ...(shouldStoreAdditionalInfo && additionalInfo ? { additional_info: additionalInfo } : {}),
      exchange_rate_at_report: exchange.rate,
      exchange_rate_date: exchange.date,
    }

    const { data: docket, error: insertError } = await supabase
      .from('dockets')
      .insert(docketInsert)
      .select('id')
      .single()

    if (insertError || !docket) {
      return Response.json(
        {
          success: false,
          error: insertError?.message ?? 'Failed to create docket',
        },
        { status: 500 }
      )
    }

    const resendApiKey = process.env.RESEND_API_KEY
    const fromEmail = process.env.FROM_EMAIL
    const devMode = process.env.DEV_MODE === 'true'
    const marcusEmail = devMode ? process.env.ADMIN_EMAIL : process.env.MARCUS_EMAIL
    const marcusCCEmail = devMode ? null : process.env.MARCUS_CC_EMAIL
    const adminEmail = process.env.ADMIN_EMAIL
    const customerOriginalEmail = customerEmail
    const customerRecipientEmail = devMode ? adminEmail : customerOriginalEmail

    if (!resendApiKey || !fromEmail) {
      return Response.json(
        { success: false, error: 'Email configuration is missing' },
        { status: 500 }
      )
    }

    const resend = new Resend(resendApiKey)
    const fullName = `${payload.customer_first_name ?? ''} ${payload.customer_last_name ?? ''}`.trim()
    const vehicle = `${payload.vehicle_make ?? ''} ${payload.vehicle_model ?? ''}`.trim()
    const customerDevPrefix =
      devMode && customerOriginalEmail
        ? `[DEV MODE — This email would normally go to: ${customerOriginalEmail}]\n\n`
        : ''
    const marcusOriginalEmail = process.env.MARCUS_EMAIL ?? null
    const marcusDevPrefix =
      devMode && marcusOriginalEmail
        ? `[DEV MODE — This email would normally go to: ${marcusOriginalEmail}]\n\n`
        : ''

    // Email 1: Customer Welcome
    try {
      const subject = 'Welcome to JDM Rush Imports'
      const bodySnapshot = `${customerDevPrefix}Hi ${payload.customer_first_name ?? 'there'},

Thanks for submitting your intake form with JDM Rush Imports.

We have created your docket (${docket.id}) and our team will review your request shortly.

Vehicle: ${vehicle}

Best,
JDM Rush Imports`
      const sendResult = await resend.emails.send({
        from: fromEmail,
        to: customerRecipientEmail ?? adminEmail ?? 'adam@jdmrushimports.ca',
        subject,
        text: bodySnapshot,
      })

      if (sendResult.error) {
        console.error('[Email #1 Send Error]', {
          docketId: docket.id,
          recipient: customerRecipientEmail ?? adminEmail ?? 'adam@jdmrushimports.ca',
          error: sendResult.error,
        })
        return Response.json({ success: false, error: 'Failed to send email' }, { status: 500 })
      }

      const { error: emailLogError } = await supabase.from('email_log').insert({
        docket_id: docket.id,
        email_type: 'email_1_customer_welcome',
        recipient_email: customerRecipientEmail ?? adminEmail ?? 'adam@jdmrushimports.ca',
        subject,
        body_snapshot: bodySnapshot,
      })

      if (emailLogError) {
        return Response.json({ success: false, error: emailLogError.message }, { status: 500 })
      }
    } catch (error) {
      console.error('[Email #1 Send Error]', {
        docketId: docket.id,
        recipient: customerRecipientEmail ?? adminEmail ?? 'adam@jdmrushimports.ca',
        error,
      })
      return Response.json({ success: false, error: 'Failed to send email' }, { status: 500 })
    }

    // Email 2: Marcus Notification
    try {
      const subject = `New Lead: ${fullName || 'Intake Submission'}`
      const bodySnapshot = `${marcusDevPrefix}New intake submitted.

Docket ID: ${docket.id}
Customer: ${fullName}
Email: ${payload.customer_email}
Phone: ${payload.customer_phone ?? 'N/A'}
Vehicle: ${vehicle}
Timeline: ${payload.timeline ?? 'N/A'}

Please review and begin follow-up.`
      const sendResult = await resend.emails.send({
        from: fromEmail,
        to: marcusEmail ?? adminEmail ?? 'adam@jdmrushimports.ca',
        ...(marcusCCEmail ? { cc: marcusCCEmail } : {}),
        subject,
        text: bodySnapshot,
      })

      if (sendResult.error) {
        console.error('[Intake Marcus Notification Send Error]', {
          docketId: docket.id,
          recipient: marcusEmail ?? adminEmail ?? 'adam@jdmrushimports.ca',
          error: sendResult.error,
        })
        return Response.json({ success: false, error: 'Failed to send email' }, { status: 500 })
      }

      const { error: emailLogError } = await supabase.from('email_log').insert({
        docket_id: docket.id,
        email_type: 'email_1_marcus_notification',
        recipient_email: marcusEmail ?? adminEmail ?? 'adam@jdmrushimports.ca',
        subject,
        body_snapshot: bodySnapshot,
      })

      if (emailLogError) {
        return Response.json({ success: false, error: emailLogError.message }, { status: 500 })
      }
    } catch (error) {
      console.error('[Intake Marcus Notification Send Error]', {
        docketId: docket.id,
        recipient: marcusEmail ?? adminEmail ?? 'adam@jdmrushimports.ca',
        error,
      })
      return Response.json({ success: false, error: 'Failed to send email' }, { status: 500 })
    }

    // Email 3: Admin Notification
    try {
      const subject = `Admin Notification: New Intake ${docket.id}`
      const bodySnapshot = `A new intake has been received and added to Supabase.

Docket ID: ${docket.id}
Customer: ${fullName}
Email: ${payload.customer_email}
Vehicle: ${vehicle}
Exchange Rate (JPY/CAD): ${exchange.rate}
Exchange Rate Date: ${exchange.date}`
      const sendResult = await resend.emails.send({
        from: fromEmail,
        to: adminEmail ?? 'adam@jdmrushimports.ca',
        subject,
        text: bodySnapshot,
      })

      if (sendResult.error) {
        console.error('[Intake Admin Notification Send Error]', {
          docketId: docket.id,
          recipient: adminEmail ?? 'adam@jdmrushimports.ca',
          error: sendResult.error,
        })
        return Response.json({ success: false, error: 'Failed to send email' }, { status: 500 })
      }

      const { error: emailLogError } = await supabase.from('email_log').insert({
        docket_id: docket.id,
        email_type: 'email_1_admin_notification',
        recipient_email: adminEmail ?? 'adam@jdmrushimports.ca',
        subject,
        body_snapshot: bodySnapshot,
      })

      if (emailLogError) {
        return Response.json({ success: false, error: emailLogError.message }, { status: 500 })
      }
    } catch (error) {
      console.error('[Intake Admin Notification Send Error]', {
        docketId: docket.id,
        recipient: adminEmail ?? 'adam@jdmrushimports.ca',
        error,
      })
      return Response.json({ success: false, error: 'Failed to send email' }, { status: 500 })
    }

    return Response.json({ success: true, docketId: docket.id })
  } catch (error) {
    console.error('[Intake] Error:', error)
    return Response.json({ success: false, error: 'Internal server error' }, { status: 500 })
  }
}
