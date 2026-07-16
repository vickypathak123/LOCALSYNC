import nodemailer, { Transporter } from 'nodemailer';

let transporter: Transporter | null = null;
let devMode = false;

function getTransporter(): Transporter {
  if (transporter) return transporter;

  if (process.env.SMTP_HOST) {
    transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT) || 587,
      secure: process.env.SMTP_PORT === '465',
      auth: process.env.SMTP_USER
        ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
        : undefined,
    });
  } else {
    // Hackathon default: no SMTP configured -> log the email instead of failing.
    // Swap in real SMTP_* env vars any time to switch to real delivery.
    devMode = true;
    transporter = nodemailer.createTransport({ jsonTransport: true });
  }

  return transporter;
}

interface SendMailOptions {
  to: string;
  subject: string;
  html: string;
}

export async function sendMail({ to, subject, html }: SendMailOptions): Promise<void> {
  const t = getTransporter();
  const from = process.env.MAIL_FROM || 'LocalSync <no-reply@localsync.dev>';

  const info = await t.sendMail({ from, to, subject, html });

  if (devMode) {
    console.log(`\n[mailer] DEV MODE (no SMTP_HOST configured) — email not actually sent.`);
    console.log(`[mailer] To: ${to} | Subject: ${subject}`);
    console.log(`[mailer] --- HTML body ---\n${html}\n[mailer] --- end body ---\n`);
  } else {
    console.log(`[mailer] sent "${subject}" to ${to} (messageId: ${info.messageId})`);
  }
}

export function sendAgentInviteEmail(opts: {
  to: string;
  agentName: string;
  orgName: string;
  tempPassword: string;
  loginUrl: string;
}): Promise<void> {
  const { to, agentName, orgName, tempPassword, loginUrl } = opts;
  const html = `
    <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto;">
      <h2 style="color:#0F766E;">You're invited to join ${orgName} on LocalSync</h2>
      <p>Hi ${agentName},</p>
      <p>You've been added as a field agent for <strong>${orgName}</strong>. Use the temporary password below to sign in for the first time — you'll be asked to set your own password right after.</p>
      <table style="margin: 16px 0;">
        <tr><td style="color:#64748B;padding-right:12px;">Email</td><td><strong>${to}</strong></td></tr>
        <tr><td style="color:#64748B;padding-right:12px;">Temporary password</td><td><strong style="font-family:monospace;font-size:16px;">${tempPassword}</strong></td></tr>
      </table>
      <p><a href="${loginUrl}" style="background:#0F766E;color:#fff;padding:10px 20px;border-radius:6px;text-decoration:none;">Sign in and set your password</a></p>
      <p style="color:#94A3B8;font-size:12px;">If the button doesn't work, open: ${loginUrl}</p>
    </div>
  `;
  return sendMail({ to, subject: `You've been invited to join ${orgName}`, html });
}
