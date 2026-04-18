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
}: {
  from: string;
  to: string;
  cc?: string | null;
  subject: string;
  html?: string;
  text?: string;
}) {
  const result = await transporter.sendMail({
    from,
    to,
    ...(cc ? { cc } : {}),
    subject,
    ...(html ? { html } : {}),
    ...(text ? { text } : {}),
  });
  return { data: result, error: null };
}
