import { Resend } from 'resend'

import { fetchJPYtoCAD } from '@/lib/exchangeRate'
import { createServerClient } from '@/lib/supabase/server'

const REQUIRED_FIELDS = [
  'customer_first_name',
  'customer_last_name',
  'customer_email',
  'vehicle_make',
  'vehicle_model',
] as const

type IntakePayload = {
  customer_first_name?: string
  customer_last_name?: string
  customer_email?: string
  customer_phone?: string
  vehicle_year?: string
  vehicle_make?: string
  vehicle_model?: string
  budget_bracket?: string
  destination_city?: string
  destination_province?: string
  vehicle_type?: string
  duty_type?: string
  timeline?: string
  additional_notes?: string
  selected_path?: string
  selected_private_dealer_option?: number | null
  [key: string]: unknown
}

function getMissingFields(payload: IntakePayload): string[] {
  return REQUIRED_FIELDS.filter((field) => {
    const value = payload[field]
    return typeof value !== 'string' || value.trim().length === 0
  })
}

function toOptionalString(value: unknown): string | null {
  if (typeof value !== 'string') {
    return null
  }

  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : null
}

export async function POST(request: Request) {
  try {
    const payload = (await request.json()) as IntakePayload
    const missingFields = getMissingFields(payload)

    if (missingFields.length > 0) {
      return Response.json(
        { success: false, error: 'Missing required fields', missingFields },
        { status: 400 }
      )
    }

    const exchange = await fetchJPYtoCAD()
    const supabase = createServerClient()

    const docketInsert = {
      status: 'new' as const,
      customer_first_name: toOptionalString(payload.customer_first_name),
      customer_last_name: toOptionalString(payload.customer_last_name),
      customer_email: toOptionalString(payload.customer_email),
      customer_phone: toOptionalString(payload.customer_phone),
      vehicle_year: toOptionalString(payload.vehicle_year),
      vehicle_make: toOptionalString(payload.vehicle_make),
      vehicle_model: toOptionalString(payload.vehicle_model),
      budget_bracket: toOptionalString(payload.budget_bracket),
      destination_city: toOptionalString(payload.destination_city),
      destination_province: toOptionalString(payload.destination_province),
      vehicle_type: toOptionalString(payload.vehicle_type),
      duty_type: toOptionalString(payload.duty_type),
      timeline: toOptionalString(payload.timeline),
      additional_notes: toOptionalString(payload.additional_notes),
      selected_path: toOptionalString(payload.selected_path),
      selected_private_dealer_option:
        typeof payload.selected_private_dealer_option === 'number'
          ? payload.selected_private_dealer_option
          : null,
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
    const moltyEmail = process.env.MOLTY_EMAIL
    const marcusEmail = process.env.MARCUS_EMAIL
    const marcusCcEmail = process.env.MARCUS_CC_EMAIL
    const adminEmail = process.env.ADMIN_EMAIL

    if (!resendApiKey || !fromEmail) {
      return Response.json(
        { success: false, error: 'Email configuration is missing' },
        { status: 500 }
      )
    }

    const resend = new Resend(resendApiKey)
    const fullName = `${payload.customer_first_name ?? ''} ${payload.customer_last_name ?? ''}`.trim()
    const vehicle = `${payload.vehicle_make ?? ''} ${payload.vehicle_model ?? ''}`.trim()

    // Email 1: Customer Welcome (delivered to admin in test mode)
    await resend.emails.send({
      from: fromEmail,
      to: adminEmail ?? 'adam@jdmrushimports.ca',
      subject: 'Welcome to JDM Rush Imports',
      text: `Hi ${payload.customer_first_name ?? 'there'},

Thanks for submitting your intake form with JDM Rush Imports.

We have created your docket (${docket.id}) and our team will review your request shortly.

Vehicle: ${vehicle}

Best,
JDM Rush Imports`,
    })

    // Email 2: Marcus Notification (delivered to admin in test mode)
    await resend.emails.send({
      from: fromEmail,
      to: adminEmail ?? 'adam@jdmrushimports.ca',
      subject: `New Lead: ${fullName || 'Intake Submission'}`,
      text: `New intake submitted.

Docket ID: ${docket.id}
Customer: ${fullName}
Email: ${payload.customer_email}
Phone: ${payload.customer_phone ?? 'N/A'}
Vehicle: ${vehicle}
Timeline: ${payload.timeline ?? 'N/A'}

Please review and begin follow-up.`,
    })

    // Email 3: Admin Notification
    await resend.emails.send({
      from: fromEmail,
      to: adminEmail ?? 'adam@jdmrushimports.ca',
      subject: `Admin Notification: New Intake ${docket.id}`,
      text: `A new intake has been received and added to Supabase.

Docket ID: ${docket.id}
Customer: ${fullName}
Email: ${payload.customer_email}
Vehicle: ${vehicle}
Exchange Rate (JPY/CAD): ${exchange.rate}
Exchange Rate Date: ${exchange.date}`,
    })

    return Response.json({ success: true, docketId: docket.id })
  } catch {
    return Response.json(
      { success: false, error: 'Invalid request body' },
      { status: 400 }
    )
  }
}
