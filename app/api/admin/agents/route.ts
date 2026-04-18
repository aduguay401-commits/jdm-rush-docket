import { sendEmail } from '@/lib/email';

import { requireAdmin } from "@/lib/admin/auth";
import { createServerClient } from "@/lib/supabase/server";

type AgentRow = {
  id: string;
  email: string | null;
  role: string | null;
  created_at: string;
};

type CreateAgentRequestBody = {
  firstName?: unknown;
  lastName?: unknown;
  email?: unknown;
  tempPassword?: unknown;
};

const LOGIN_URL = "https://jdm-rush-docket.vercel.app/agent/login";

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function buildWelcomeEmail({
  firstName,
  email,
  tempPassword,
  devMode,
  originalRecipient,
}: {
  firstName: string;
  email: string;
  tempPassword: string;
  devMode: boolean;
  originalRecipient: string;
}) {
  const safeFirstName = escapeHtml(firstName);
  const safeEmail = escapeHtml(email);
  const safeTempPassword = escapeHtml(tempPassword);
  const safeOriginalRecipient = escapeHtml(originalRecipient);
  const subject = `Welcome to the JDM Rush Team, ${firstName}!`;

  const devBanner =
    devMode && originalRecipient
      ? `<div style="margin:0 0 16px;padding:12px;border:1px solid #E55125;border-radius:8px;background:#2a130a;color:#f8d1c5;font-size:13px;">[DEV MODE] This email would normally go to ${safeOriginalRecipient}</div>`
      : "";
  const devTextBanner =
    devMode && originalRecipient
      ? `[DEV MODE] This email would normally go to ${originalRecipient}\n\n`
      : "";

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
                <h1 style="margin:0 0 14px;font-size:24px;line-height:1.3;color:#ffffff;">Welcome to the team, ${safeFirstName}! 🇯🇵</h1>
                <p style="margin:0 0 16px;font-size:15px;line-height:1.7;color:#d6d6d6;">You have been added as an Export Agent for JDM Rush Imports. Here are your login credentials to access the agent portal.</p>
                <div style="margin:0 0 18px;border:1px solid #3a3a3a;border-radius:10px;background:#151515;padding:14px;">
                  <p style="margin:0 0 8px;font-size:14px;color:#E55125;">Login URL</p>
                  <p style="margin:0 0 14px;font-size:14px;color:#f2f2f2;">${LOGIN_URL}</p>
                  <p style="margin:0 0 8px;font-size:14px;color:#E55125;">Email</p>
                  <p style="margin:0 0 14px;font-size:14px;color:#f2f2f2;">${safeEmail}</p>
                  <p style="margin:0 0 8px;font-size:14px;color:#E55125;">Temporary Password</p>
                  <p style="margin:0;font-size:14px;color:#f2f2f2;">${safeTempPassword}</p>
                </div>
                <p style="margin:0 0 20px;font-size:15px;line-height:1.7;color:#d6d6d6;">Please log in and change your password as soon as possible.</p>
                <a href="${LOGIN_URL}" style="display:inline-block;border-radius:8px;background:#E55125;color:#ffffff;padding:11px 16px;font-size:14px;font-weight:700;text-decoration:none;">Access Agent Portal</a>
                <p style="margin:20px 0 0;font-size:14px;line-height:1.6;color:#d0d0d0;">Adam and the JDM Rush Team<br/>support@jdmrushimports.ca</p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;

  const text = `${devTextBanner}Welcome to the team, ${firstName}! 🇯🇵

You have been added as an Export Agent for JDM Rush Imports. Here are your login credentials to access the agent portal.

Login URL: ${LOGIN_URL}
Email: ${email}
Temporary Password: ${tempPassword}

Please log in and change your password as soon as possible.

Access Agent Portal: ${LOGIN_URL}

Adam and the JDM Rush Team
support@jdmrushimports.ca`;

  return { subject, html, text };
}

function asNonEmptyString(value: unknown) {
  if (typeof value !== "string") {
    return null;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

export async function GET() {
  if (!(await requireAdmin())) {
    return Response.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createServerClient();
  const { data, error } = await supabase
    .from("profiles")
    .select("id, email, role, created_at")
    .eq("role", "agent")
    .order("created_at", { ascending: false });

  if (error) {
    return Response.json({ success: false, error: error.message }, { status: 500 });
  }

  return Response.json({ success: true, agents: (data ?? []) as AgentRow[] });
}

export async function POST(request: Request) {
  if (!(await requireAdmin())) {
    return Response.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  const payload = (await request.json()) as CreateAgentRequestBody;
  const firstName = asNonEmptyString(payload.firstName);
  const lastName = asNonEmptyString(payload.lastName);
  const email = asNonEmptyString(payload.email)?.toLowerCase();
  const tempPassword = asNonEmptyString(payload.tempPassword);

  if (!firstName || !lastName || !email || !tempPassword) {
    return Response.json({ success: false, error: "Missing required fields" }, { status: 400 });
  }

  if (tempPassword.length < 8) {
    return Response.json({ success: false, error: "Temporary password must be at least 8 characters" }, { status: 400 });
  }
  const fromEmail = process.env.FROM_EMAIL;
  const adminEmail = process.env.ADMIN_EMAIL ?? "adam@jdmrushimports.ca";
  const devMode = process.env.DEV_MODE === "true";

  const supabase = createServerClient();

  const createdAuthUser = await supabase.auth.admin.createUser({
    email,
    password: tempPassword,
    email_confirm: true,
  });

  if (createdAuthUser.error || !createdAuthUser.data.user) {
    return Response.json(
      { success: false, error: createdAuthUser.error?.message ?? "Failed to create auth user" },
      { status: 500 }
    );
  }

  const authUserId = createdAuthUser.data.user.id;

  const { data: insertedProfile, error: profileError } = await supabase
    .from("profiles")
    .insert({ id: authUserId, email, role: "agent" })
    .select("id, email, role, created_at")
    .single<AgentRow>();

  if (profileError) {
    await supabase.auth.admin.deleteUser(authUserId);
    return Response.json({ success: false, error: profileError.message }, { status: 500 });
  }

  const recipientEmail = devMode ? adminEmail : email;
  const emailContent = buildWelcomeEmail({
    firstName,
    email,
    tempPassword,
    devMode,
    originalRecipient: email,
  });

  let emailSent = false;
  try {
    if (!fromEmail) {
      throw new Error("Email configuration is missing");
    }

    const sendResult = await sendEmail({
      from: fromEmail,
      to: recipientEmail,
      subject: emailContent.subject,
      html: emailContent.html,
      text: emailContent.text,
    });

    if (sendResult.error) {
      console.error("Failed to send welcome email", sendResult.error);
    } else {
      emailSent = true;
    }
  } catch (emailError) {
    console.error("Failed to send welcome email", emailError);
  }

  return Response.json({ success: true, agent: insertedProfile, emailSent });
}
