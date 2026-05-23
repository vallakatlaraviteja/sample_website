// Resend wrapper. If RESEND_API_KEY is unset, we log to console (dev/free path).
// Resend free tier: 3,000 emails/month, 100/day. Plenty for v0 alerts.

async function sendEmail({ to, subject, html, text }) {
  if (!process.env.RESEND_API_KEY) {
    console.log(`[email:dryrun] to=${to} subject="${subject}"`);
    if (process.env.NODE_ENV !== 'production') console.log(text || html);
    return { dryrun: true };
  }
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: process.env.EMAIL_FROM || 'alerts@terrapulse.example',
      to: Array.isArray(to) ? to : [to],
      subject,
      html,
      text,
    }),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`resend ${res.status} ${body}`);
  }
  return res.json();
}

module.exports = { sendEmail };
