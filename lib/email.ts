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
}: {
  from: string;
  to: string;
  cc?: string | null;
  subject: string;
  html?: string;
  text?: string;
  attachments?: { filename: string; content: Buffer; contentType?: string }[];
}) {
  const formattedFrom = from.includes('<')
    ? from
    : `JDM Rush Imports <${from}>`;

  const result = await transporter.sendMail({
    from: formattedFrom,
    to,
    ...(cc ? { cc } : {}),
    subject,
    ...(html ? { html } : {}),
    ...(text ? { text } : {}),
    ...(attachments ? { attachments } : {}),
  });
  return { data: result, error: null };
}
