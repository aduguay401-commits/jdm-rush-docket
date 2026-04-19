// SQL migration note:
// ALTER TABLE dockets ADD COLUMN IF NOT EXISTS vehicle_description TEXT;
// SQL migration note:
// ALTER TABLE dockets ADD COLUMN IF NOT EXISTS additional_info JSONB;

import { sendEmail } from '@/lib/email'

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
  vehicle_description?: string
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

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
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
    const customerFirstName = toOptionalString(payload.customer_first_name)
    const customerLastName = toOptionalString(payload.customer_last_name)
    const customerPhone = toOptionalString(payload.customer_phone)
    const vehicleYear = toOptionalString(payload.vehicle_year)
    const vehicleMake = toOptionalString(payload.vehicle_make)
    const vehicleModel = toOptionalString(payload.vehicle_model)
    const vehicleDescription = toOptionalString(payload.vehicle_description)
    const budgetBracket = toOptionalString(payload.budget_bracket ?? payload.budget)
    const timeline = toOptionalString(payload.timeline)
    const additionalNotes = toOptionalString(payload.additional_notes)
    const selectedPath = toOptionalString(payload.selected_path)
    const selectedPrivateDealerOption = toOptionalNumber(payload.selected_private_dealer_option)

    const docketInsert = {
      status: 'new' as const,
      customer_first_name: customerFirstName,
      customer_last_name: customerLastName,
      customer_email: customerEmail,
      customer_phone: customerPhone,
      vehicle_year: vehicleYear,
      vehicle_make: vehicleMake,
      vehicle_model: vehicleModel,
      vehicle_description: vehicleDescription,
      budget_bracket: budgetBracket,
      destination_city: destinationCity,
      destination_province: destinationProvince,
      vehicle_type: toOptionalString(payload.vehicle_type),
      duty_type: toOptionalString(payload.duty_type),
      timeline,
      additional_notes: additionalNotes,
      selected_path: selectedPath,
      selected_private_dealer_option: selectedPrivateDealerOption,
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
    const fromEmail = process.env.FROM_EMAIL
    const devMode = process.env.DEV_MODE === 'true'
    const marcusEmail = devMode ? process.env.ADMIN_EMAIL : process.env.MARCUS_EMAIL
    const marcusCCEmail = devMode ? null : process.env.MARCUS_CC_EMAIL
    const adminEmail = process.env.ADMIN_EMAIL
    const customerOriginalEmail = customerEmail
    const customerRecipientEmail = devMode ? adminEmail : customerOriginalEmail

    if (!fromEmail) {
      return Response.json(
        { success: false, error: 'Email configuration is missing' },
        { status: 500 }
      )
    }
    const fullName = `${customerFirstName ?? ''} ${customerLastName ?? ''}`.trim()
    const customerFirstNameForEmail = customerFirstName ?? 'there'
    const makeModelForSummary = [vehicleMake, vehicleModel].filter(Boolean).join(' ')
    const vehicleForSummary =
      vehicleDescription ?? (makeModelForSummary.length > 0 ? makeModelForSummary : 'N/A')
    const destinationForSummary =
      [destinationCity, destinationProvince].filter(Boolean).join(', ') || 'N/A'
    const timelineForSummary = timeline ?? 'N/A'
    const budgetForSummary = budgetBracket ?? 'N/A'
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
      const subject = `Welcome to JDM Rush — your docket is ready, ${customerFirstNameForEmail}`
      const devModeBannerHtml =
        devMode && customerOriginalEmail
          ? `<div style='margin: 0 0 20px; background: #2a130a; border: 1px solid #E55125; border-radius: 8px; padding: 12px; color: #f8d1c5; font-size: 13px;'>[DEV MODE] This email would normally go to: ${escapeHtml(customerOriginalEmail)}</div>`
          : ''
      const bodySnapshot = `<div style='font-family: sans-serif; max-width: 600px; margin: 0 auto; background: #0d0d0d; color: #ffffff; padding: 40px 32px; border-radius: 12px;'>
  ${devModeBannerHtml}
  <img src='https://scfezjqjbzqbtfsveedl.supabase.co/storage/v1/object/public/docket-files/Assets/JDMRUSH_Imports_RGB_Colour-white_png.png' alt='JDM Rush Imports' style='height: 50px; margin-bottom: 32px; display: block;' />
  <h1 style='font-size: 24px; font-weight: 700; margin-bottom: 8px;'>Your JDM search starts now… 🇯🇵</h1>
  <p style='color: #aaaaaa; font-size: 15px; margin-bottom: 24px;'>Hi ${escapeHtml(customerFirstNameForEmail)},</p>
  <p style='color: #cccccc; font-size: 15px; line-height: 1.7;'>
    Thanks for reaching out to JDM Rush Imports. We have received your request and created your personal import docket. Our team is reviewing your submission now and will be in touch shortly.
  </p>
  <div style='background: #1a1a1a; border-radius: 10px; padding: 24px; margin: 28px 0;'>
    <p style='font-size: 13px; color: #E55125; font-weight: 700; letter-spacing: 0.08em; margin: 0 0 12px 0;'>YOUR REQUEST SUMMARY</p>
    <p style='font-size: 14px; color: #aaaaaa; margin: 4px 0;'><strong style='color: #ffffff;'>Vehicle:</strong> ${escapeHtml(vehicleForSummary)}</p>
    <p style='font-size: 14px; color: #aaaaaa; margin: 4px 0;'><strong style='color: #ffffff;'>Destination:</strong> ${escapeHtml(destinationForSummary)}</p>
    <p style='font-size: 14px; color: #aaaaaa; margin: 4px 0;'><strong style='color: #ffffff;'>Timeline:</strong> ${escapeHtml(timelineForSummary)}</p>
    <p style='font-size: 14px; color: #aaaaaa; margin: 4px 0;'><strong style='color: #ffffff;'>Budget:</strong> ${escapeHtml(budgetForSummary)}</p>
  </div>
  <p style='color: #cccccc; font-size: 15px; line-height: 1.7;'>
    While you wait, feel free to explore our <a href='https://www.jdmrushimports.ca/import-calculator' style='color: #E55125;'>Import Calculator</a> to get a sense of total landed costs for your vehicle.
  </p>
  <p style='color: #666666; font-size: 13px; margin-top: 32px; line-height: 1.6;'>
    Questions? Just reply to this email — we are here every step of the way.
  </p>
  <p style='color: #888888; font-size: 14px; margin-top: 32px;'>
    Adam & the JDM Rush Team<br/>
    <a href='mailto:support@jdmrushimports.ca' style='color: #E55125;'>support@jdmrushimports.ca</a>
  </p>
</div>`
      const textBody = `${customerDevPrefix}Your JDM search starts now… 🇯🇵

Hi ${customerFirstNameForEmail},

Thanks for reaching out to JDM Rush Imports. We have received your request and created your personal import docket. Our team is reviewing your submission now and will be in touch shortly.

Your request summary
- Vehicle: ${vehicleForSummary}
- Destination: ${destinationForSummary}
- Timeline: ${timelineForSummary}
- Budget: ${budgetForSummary}

Explore our Import Calculator:
https://www.jdmrushimports.ca/import-calculator

Questions? Reply to this email.

Adam & the JDM Rush Team
support@jdmrushimports.ca`
      const sendResult = await sendEmail({
        from: fromEmail,
        to: customerRecipientEmail ?? adminEmail ?? 'adam@jdmrushimports.ca',
        subject,
        html: bodySnapshot,
        text: textBody,
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
Vehicle: ${vehicleForSummary}
Timeline: ${payload.timeline ?? 'N/A'}

Please review and begin follow-up.`
      const sendResult = await sendEmail({
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
      const subject = `New Docket — ${fullName || 'Unknown Customer'} / ${vehicleForSummary}`
      const bodySnapshot = `A new intake has been received and added to Supabase.

Docket ID: ${docket.id}
Customer: ${fullName}
Email: ${payload.customer_email}
Vehicle: ${vehicleForSummary}
Exchange Rate (JPY/CAD): ${exchange.rate}
Exchange Rate Date: ${exchange.date}`
      const sendResult = await sendEmail({
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
