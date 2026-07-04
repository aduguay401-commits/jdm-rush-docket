import nodemailer from 'nodemailer';

const transporter = nodemailer.createTransport({
  host: 'smtp.gmail.com',
  port: 465,
  secure: true,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

export async function sendEmail({
  from,
  to,
  cc,
  subject,
  html,
  text,
  attachments,
  headers,
  listUnsubscribe,
}: {
  from: string;
  to: string;
  cc?: string | null;
  subject: string;
  html?: string;
  text?: string;
  attachments?: { filename: string; content: Buffer; contentType?: string }[];
  headers?: Record<string, string>;
  listUnsubscribe?: {
    url: string;
    mailto?: string;
    oneClick?: boolean;
  };
}) {
  const formattedFrom = from.includes('<')
    ? from
    : `JDM Rush Imports <${from}>`;

  const messageHeaders: Record<string, string> = { ...(headers ?? {}) };
  if (listUnsubscribe) {
    const values = [`<${listUnsubscribe.url}>`];
    if (listUnsubscribe.mailto) {
      values.push(`<mailto:${listUnsubscribe.mailto}>`);
    }
    messageHeaders['List-Unsubscribe'] = values.join(', ');
    if (listUnsubscribe.oneClick) {
      messageHeaders['List-Unsubscribe-Post'] = 'List-Unsubscribe=One-Click';
    }
  }

  const result = await transporter.sendMail({
    from: formattedFrom,
    to,
    ...(cc ? { cc } : {}),
    subject,
    ...(html ? { html } : {}),
    ...(text ? { text } : {}),
    ...(attachments ? { attachments } : {}),
    ...(Object.keys(messageHeaders).length > 0 ? { headers: messageHeaders } : {}),
  });
  return { data: result, error: null };
}
