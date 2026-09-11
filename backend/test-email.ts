import * as dotenv from 'dotenv';
import * as nodemailer from 'nodemailer';

dotenv.config();

async function run() {
  const host = process.env.MAIL_HOST;
  const user = process.env.MAIL_USER;
  const pass = process.env.MAIL_PASSWORD;
  const from = process.env.MAIL_FROM || process.env.MAIL_USER || 'BhoomiSetu <no-reply@bhoomisetu.gov.in>';

  if (!host || !user || !pass) {
    console.error('Missing MAIL_HOST, MAIL_USER, or MAIL_PASSWORD in .env');
    process.exit(1);
  }

  const transporter = nodemailer.createTransport({
    host,
    port: Number(process.env.MAIL_PORT ?? 465),
    secure: (process.env.MAIL_SECURE ?? 'true') === 'true',
    auth: { user, pass },
  });

  console.log(`Attempting to send email via ${host} to avgore2005@gmail.com...`);

  try {
    const info = await transporter.sendMail({
      from,
      to: 'avgore2005@gmail.com',
      subject: 'Test Email from BhoomiSetu',
      text: 'This is a test email to verify Zoho Mail integration.',
      html: '<p>This is a test email to verify Zoho Mail integration.</p>'
    });
    console.log('Email sent successfully!');
    console.log('Message ID:', info.messageId);
  } catch (error) {
    console.error('Failed to send email:', error);
  }
}

run();
