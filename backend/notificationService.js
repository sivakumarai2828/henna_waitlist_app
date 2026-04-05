import nodemailer from 'nodemailer';
import dotenv from 'dotenv';
dotenv.config();

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.GMAIL_USER,
    pass: process.env.GMAIL_APP_PASSWORD
  }
});

const INSTAGRAM = 'https://www.instagram.com/anuushennaart?igsh=NTc4MTIwNjQ2YQ%3D%3D&utm_source=qr';
const FROM = `"Anuu's Henna Art" <${process.env.GMAIL_USER}>`;

const sendEmail = async (to, subject, html) => {
  try {
    const info = await transporter.sendMail({ from: FROM, to, subject, html });
    console.log(`✅ Email sent to ${to} | ID: ${info.messageId}`);
  } catch (err) {
    console.error(`❌ Email failed to ${to}:`, err.message);
  }
};

const sendJoinedMessage = (user, position) => {
  const subject = "You're in the queue! 🌿 Anuu's Henna Art";
  const html = `
    <div style="font-family:sans-serif;max-width:480px;margin:auto;padding:24px;border:1px solid #eee;border-radius:12px;">
      <h2 style="color:#4A1040;">🌿 Anuu's Henna Art</h2>
      <p>Hi <strong>${user.name}</strong>!</p>
      <p>You've successfully joined our queue.</p>
      <div style="background:#f9f3ff;border-radius:8px;padding:16px;text-align:center;margin:20px 0;">
        <p style="margin:0;color:#888;font-size:13px;">YOUR POSITION</p>
        <p style="margin:4px 0;font-size:48px;font-weight:bold;color:#4A1040;">#${position}</p>
        <p style="margin:0;color:#666;font-size:13px;">${position === 1 ? "You're next!" : `${position - 1} person${position - 1 > 1 ? 's' : ''} ahead of you`}</p>
      </div>
      <p>We'll email you when it's almost your turn — please stay nearby!</p>
      <p style="margin-top:24px;">
        📸 Follow us on Instagram for our latest designs:<br/>
        <a href="${INSTAGRAM}" style="color:#C9952A;">${INSTAGRAM}</a>
      </p>
      <p style="color:#888;font-size:12px;margin-top:24px;">Anuu's Henna Art — Queue Notification</p>
    </div>
  `;
  return sendEmail(user.email, subject, html);
};

const sendAlmostTurnMessage = (user) => {
  const subject = "You're almost up! 👋 Anuu's Henna Art";
  const html = `
    <div style="font-family:sans-serif;max-width:480px;margin:auto;padding:24px;border:1px solid #eee;border-radius:12px;">
      <h2 style="color:#4A1040;">🌿 Anuu's Henna Art</h2>
      <p>Hey <strong>${user.name}</strong>!</p>
      <p>You're <strong>almost up</strong> in our queue. Please make your way back to the stall now!</p>
      <p style="color:#888;font-size:12px;margin-top:24px;">Anuu's Henna Art — Queue Notification</p>
    </div>
  `;
  return sendEmail(user.email, subject, html);
};

const sendTurnMessage = (user) => {
  const subject = "🎉 It's your turn! Anuu's Henna Art";
  const html = `
    <div style="font-family:sans-serif;max-width:480px;margin:auto;padding:24px;border:1px solid #eee;border-radius:12px;">
      <h2 style="color:#4A1040;">🌿 Anuu's Henna Art</h2>
      <p>Hi <strong>${user.name}</strong>!</p>
      <p style="font-size:18px;color:#4A1040;"><strong>It's your turn!</strong></p>
      <p>Please come to the stall right now — we're ready for you!</p>
      <p style="color:#888;font-size:12px;margin-top:24px;">Anuu's Henna Art — Queue Notification</p>
    </div>
  `;
  return sendEmail(user.email, subject, html);
};

export default {
  sendJoinedMessage,
  sendAlmostTurnMessage,
  sendTurnMessage
};
