import twilio from 'twilio';
import dotenv from 'dotenv';
dotenv.config();

const client = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
const FROM = `whatsapp:${process.env.TWILIO_WHATSAPP_NUMBER}`;
const INSTAGRAM = 'https://www.instagram.com/anuushennaart?igsh=NTc4MTIwNjQ2YQ%3D%3D&utm_source=qr';

const sendWhatsApp = async (phone, message) => {
  try {
    const to = `whatsapp:${phone}`;
    const msg = await client.messages.create({ from: FROM, to, body: message });
    console.log(`✅ WhatsApp sent to ${phone} | SID: ${msg.sid}`);
  } catch (err) {
    console.error(`❌ WhatsApp failed to ${phone}:`, err.message);
  }
};

const sendJoinedMessage = (user) => {
  const message = `Hi ${user.name}! 🌿 You've joined the *Anuu's Henna Art* queue.\n\nWe'll message you when it's almost your turn. Please stay nearby!\n\n📸 Follow us on Instagram for our latest designs & updates:\n${INSTAGRAM}`;
  return sendWhatsApp(user.phone, message);
};

const sendAlmostTurnMessage = (user) => {
  const message = `Hey ${user.name}! 👋 You're *almost up* at Anuu's Henna Art.\n\nPlease make your way back to the stall now!`;
  return sendWhatsApp(user.phone, message);
};

const sendTurnMessage = (user) => {
  const message = `🎉 It's your turn, ${user.name}!\n\nPlease come to the *Anuu's Henna Art* stall right now. We're ready for you!`;
  return sendWhatsApp(user.phone, message);
};

export default {
  sendJoinedMessage,
  sendAlmostTurnMessage,
  sendTurnMessage
};
