import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { Resend } from 'resend'

type SequenceType = 'A' | 'B' | 'C'

type FollowUpSequenceRow = {
  id: string
  docket_id: string
  sequence_type: string | null
  step: number | null
  status: string | null
  next_send_at: string | null
  cancelled_at: string | null
  completed_at: string | null
  emails_sent?: number | null
}

type DocketRow = {
  id: string
  status: string | null
  is_archived: boolean | null
  is_flagged: boolean | null
  customer_first_name: string | null
  customer_email: string | null
  vehicle_year: string | null
  vehicle_make: string | null
  vehicle_model: string | null
}

const DAY_MS = 24 * 60 * 60 * 1000
const DEV_MODE = process.env.DEV_MODE === 'true'

const SUBJECTS: Record<SequenceType, Record<1 | 2 | 3, string>> = {
  A: {
    1: 'Quick question about your [vehicle]',
    2: "Still here when you're ready — [vehicle]",
    3: 'Last check-in on your [vehicle]',
  },
  B: {
    1: 'Your [vehicle] report is waiting',
    2: "Don't miss your window — [vehicle]",
    3: 'Final follow-up on your [vehicle]',
  },
  C: {
    1: 'Complete your purchase — [vehicle]',
    2: 'Your spot is still reserved — [vehicle]',
    3: 'Last chance to lock in your [vehicle]',
  },
}

const BODY_LINES: Record<SequenceType, Record<1 | 2 | 3, string>> = {
  A: {
    1: 'Wanted to quickly check in and see if your preferences or timing have changed at all.',
    2: 'We are still ready to move forward as soon as you are, and we can adjust your search immediately.',
    3: 'This is our last check-in for now. If you still want to proceed, just reply and we will jump back in.',
  },
  B: {
    1: 'Your report is ready and waiting for review whenever you are ready to take a look.',
    2: 'A quick response keeps your best options open while current inventory is still available.',
    3: 'This is our final follow-up on your report. Reply if you want us to keep this moving.',
  },
  C: {
    1: 'You are at the final stage. Reply if you want us to help you complete the purchase steps.',
    2: 'Your spot is still reserved, and we can keep your deal moving with a quick confirmation.',
    3: 'This is the final reminder before we close this sequence. Reply to keep your file active.',
  },
}

const SEQUENCE_TIMING: Record<string, number[]> = {
  A: [0, 3, 7],
  B: [0, 4, 10],
  C: [0, 3, 7],
}

function asSequenceType(value: string | null): SequenceType | null {
  if (!value) {
    return null
  }

  const normalized = value.toUpperCase()
  if (normalized === 'A' || normalized === 'B' || normalized === 'C') {
    return normalized
  }

  return null
}

function normalizeStep(value: number | null): 1 | 2 | 3 {
  if (value === 2 || value === 3) {
    return value
  }

  return 1
}

function nonEmpty(value: string | null | undefined): string | null {
  if (typeof value !== 'string') {
    return null
  }

  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : null
}

function buildVehicleLabel(docket: DocketRow): string {
  const label = [docket.vehicle_year, docket.vehicle_make, docket.vehicle_model]
    .map((item) => nonEmpty(item))
    .filter((item): item is string => Boolean(item))
    .join(' ')

  return label.length > 0 ? label : 'vehicle'
}

function buildEmailContent({
  sequenceType,
  step,
  firstName,
  vehicle,
  devMode,
  originalRecipient,
}: {
  sequenceType: SequenceType
  step: 1 | 2 | 3
  firstName: string
  vehicle: string
  devMode: boolean
  originalRecipient: string | null
}) {
  const rawSubject = SUBJECTS[sequenceType][step]
  const subject = rawSubject.replace('[vehicle]', vehicle)
  const bodyLine = BODY_LINES[sequenceType][step]
  const devBanner =
    devMode && originalRecipient
      ? `<div style="margin:0 0 16px;padding:12px;border:1px solid #E55125;border-radius:8px;background:#2a130a;color:#f8d1c5;font-size:13px;">[DEV MODE] This email would normally go to ${originalRecipient}</div>`
      : ''
  const devTextBanner =
    devMode && originalRecipient
      ? `[DEV MODE] This email would normally go to ${originalRecipient}\n\n`
      : ''

  const html = `<!doctype html>
<html lang="en">
  <body style="margin:0;background:#0d0d0d;color:#ffffff;font-family:Arial,sans-serif;">
    <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="background:#0d0d0d;padding:24px 12px;">
      <tr>
        <td align="center">
          <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="max-width:640px;background:#111111;border:1px solid #2a2a2a;border-radius:16px;overflow:hidden;">
            <tr>
              <td style="padding:20px 24px;border-bottom:1px solid #2a2a2a;">
                <img src='https://scfezjqjbzqbtfsveedl.supabase.co/storage/v1/object/public/docket-files/Assets/JDMRUSH_Imports_RGB_Colour-white_png.png' alt='JDM Rush Imports' style='height: 50px; margin-bottom: 32px; display: block;' />
              </td>
            </tr>
            <tr>
              <td style="padding:24px;">
                ${devBanner}
                <h1 style="margin:0 0 14px;font-size:24px;line-height:1.3;color:#ffffff;">${subject}</h1>
                <p style="margin:0 0 14px;font-size:15px;line-height:1.7;color:#efefef;">Hi ${firstName},</p>
                <p style="margin:0 0 16px;font-size:15px;line-height:1.7;color:#d6d6d6;">${bodyLine}</p>
                <p style="margin:0 0 20px;font-size:15px;line-height:1.7;color:#d6d6d6;">If you have updates on budget, timing, or vehicle preferences, reply and we will adjust immediately.</p>
                <p style="margin:0;color:#E55125;font-size:14px;line-height:1.6;">Adam &amp; the JDM Rush Team<br />support@jdmrushimports.ca</p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`

  const text = `${devTextBanner}Hi ${firstName},

${bodyLine}

If you have updates on budget, timing, or vehicle preferences, reply and we will adjust immediately.

Adam & the JDM Rush Team
support@jdmrushimports.ca`

  return { subject, html, text }
}

async function cancelSequence(
  supabase: SupabaseClient,
  sequenceId: string,
  nowIso: string
) {
  return supabase
    .from('follow_up_sequences')
    .update({
      status: 'cancelled',
      cancelled_at: nowIso,
    })
    .eq('id', sequenceId)
}

export async function POST(request: Request) {
  const cronSecret = process.env.CRON_SECRET
  const authorization = request.headers.get('authorization')

  if (!cronSecret || authorization !== `Bearer ${cronSecret}`) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  const resendApiKey = process.env.RESEND_API_KEY
  const fromEmail = process.env.FROM_EMAIL
  const adminEmail = process.env.ADMIN_EMAIL ?? 'adam@jdmrushimports.ca'

  if (!supabaseUrl || !serviceRoleKey || !resendApiKey || !fromEmail) {
    return Response.json({ error: 'Server configuration is missing' }, { status: 500 })
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  })
  const resend = new Resend(resendApiKey)
  const nowIso = new Date().toISOString()

  const { data: sequences, error: sequencesError } = await supabase
    .from('follow_up_sequences')
    .select('id, docket_id, sequence_type, step, status, next_send_at, cancelled_at, completed_at, emails_sent')
    .eq('status', 'active')
    .lte('next_send_at', nowIso)
    .is('cancelled_at', null)
    .is('completed_at', null)

  if (sequencesError) {
    return Response.json({ error: sequencesError.message }, { status: 500 })
  }

  const dueSequences = (sequences ?? []) as FollowUpSequenceRow[]

  if (dueSequences.length === 0) {
    return Response.json({ message: 'No due follow-up sequences', processed: 0 })
  }

  const docketIds = Array.from(new Set(dueSequences.map((sequence) => sequence.docket_id)))

  const { data: dockets, error: docketsError } = await supabase
    .from('dockets')
    .select(
      'id, status, is_archived, is_flagged, customer_first_name, customer_email, vehicle_year, vehicle_make, vehicle_model'
    )
    .in('id', docketIds)

  if (docketsError) {
    return Response.json({ error: docketsError.message }, { status: 500 })
  }

  const docketById = new Map<string, DocketRow>()
  for (const docket of (dockets ?? []) as DocketRow[]) {
    docketById.set(docket.id, docket)
  }

  let processed = 0

  for (const sequence of dueSequences) {
    const docket = docketById.get(sequence.docket_id)

    if (!docket) {
      const { error } = await cancelSequence(supabase, sequence.id, nowIso)
      if (!error) {
        processed += 1
      }
      continue
    }

    const docketStatus = nonEmpty(docket.status)?.toLowerCase() ?? null
    if (docket.is_archived || docketStatus === 'cleared' || docketStatus === 'lost') {
      const { error } = await cancelSequence(supabase, sequence.id, nowIso)
      if (!error) {
        processed += 1
      }
      continue
    }

    const sequenceType = asSequenceType(sequence.sequence_type)
    if (!sequenceType) {
      const { error } = await cancelSequence(supabase, sequence.id, nowIso)
      if (!error) {
        processed += 1
      }
      continue
    }

    const step = normalizeStep(sequence.step)
    const firstName = nonEmpty(docket.customer_first_name) ?? 'there'
    const originalRecipient = nonEmpty(docket.customer_email)
    const recipientEmail = DEV_MODE ? adminEmail : originalRecipient

    if (!recipientEmail) {
      const { error } = await cancelSequence(supabase, sequence.id, nowIso)
      if (!error) {
        processed += 1
      }
      continue
    }

    const vehicle = buildVehicleLabel(docket)
    const { subject, html, text } = buildEmailContent({
      sequenceType,
      step,
      firstName,
      vehicle,
      devMode: DEV_MODE,
      originalRecipient,
    })

    try {
      const sendResult = await resend.emails.send({
        from: fromEmail,
        to: recipientEmail,
        subject,
        html,
        text,
      })

      if (sendResult.error) {
        console.error('[Follow-up Email Send Error]', {
          sequenceId: sequence.id,
          docketId: docket.id,
          sequenceType,
          step,
          recipient: recipientEmail,
          error: sendResult.error,
        })
        continue
      }
    } catch (error) {
      console.error('[Follow-up Email Send Error]', {
        sequenceId: sequence.id,
        docketId: docket.id,
        sequenceType,
        step,
        recipient: recipientEmail,
        error,
      })
      continue
    }

    const { error: emailLogError } = await supabase.from('email_log').insert({
      docket_id: docket.id,
      email_type: `sequence_${sequenceType}_step_${step}`,
      recipient_email: recipientEmail,
      subject,
      body_snapshot: html,
    })

    if (emailLogError) {
      continue
    }

    const nextEmailsSent = (typeof sequence.emails_sent === 'number' ? sequence.emails_sent : 0) + 1

    if (step < 3) {
      const timings = SEQUENCE_TIMING[sequenceType] ?? [0, 0, 0]
      const currentIndex = step - 1
      const nextIndex = step
      const delayDays = Math.max(
        0,
        (timings[nextIndex] ?? 0) - (timings[currentIndex] ?? 0)
      )
      const nextSendAt = new Date(Date.now() + delayDays * DAY_MS).toISOString()

      const { error: updateSequenceError } = await supabase
        .from('follow_up_sequences')
        .update({
          step: step + 1,
          next_send_at: nextSendAt,
          last_sent_at: nowIso,
          emails_sent: nextEmailsSent,
        })
        .eq('id', sequence.id)

      if (updateSequenceError) {
        continue
      }

      processed += 1
      continue
    }

    const { error: completeSequenceError } = await supabase
      .from('follow_up_sequences')
      .update({
        status: 'completed',
        completed_at: nowIso,
        last_sent_at: nowIso,
        emails_sent: nextEmailsSent,
      })
      .eq('id', sequence.id)

    if (completeSequenceError) {
      continue
    }

    const oldStatus = docket.status

    const { error: docketUpdateError } = await supabase
      .from('dockets')
      .update({
        status: 'unresponsive',
        is_flagged: true,
      })
      .eq('id', docket.id)

    if (docketUpdateError) {
      continue
    }

    const { error: historyError } = await supabase.from('docket_status_history').insert({
      docket_id: docket.id,
      old_status: oldStatus,
      new_status: 'unresponsive',
      changed_by: 'system',
    })

    if (historyError) {
      continue
    }

    processed += 1
  }

  return Response.json({
    message: `Processed ${processed} follow-up sequence(s)`,
    processed,
  })
}
