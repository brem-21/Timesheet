/* Clock-It — Teams transcript extractor
   Injected into teams.microsoft.com pages */

const CLOCKIT_DEFAULT = "http://localhost:3000";
const WIDGET_ID = "clockit-widget";

// ── Selectors to try for transcript items ────────────────────────────────────
// Teams changes its CSS classes often; we try multiple patterns
const TRANSCRIPT_SELECTORS = [
  '[data-tid="calling-transcript-item"]',
  '[data-cid="ts-message"]',
  '[class*="transcript-item"]',
  '[class*="transcriptItem"]',
  '[class*="ts-segment"]',
  '[data-tid="transcript-segment"]',
];

const SPEAKER_SELECTORS = [
  '[data-tid="calling-transcript-speaker-name"]',
  '[class*="speaker-name"]',
  '[class*="speakerName"]',
  '[class*="transcript-speaker"]',
];

const TEXT_SELECTORS = [
  '[data-tid="calling-transcript-text"]',
  '[class*="transcript-text"]',
  '[class*="transcriptText"]',
  '[class*="ts-text"]',
];

// ── Extract transcript from DOM ───────────────────────────────────────────────
function extractFromDOM() {
  let items = [];

  for (const sel of TRANSCRIPT_SELECTORS) {
    const nodes = document.querySelectorAll(sel);
    if (nodes.length === 0) continue;

    nodes.forEach((node) => {
      let speaker = "";
      let text = "";

      for (const ss of SPEAKER_SELECTORS) {
        const el = node.querySelector(ss);
        if (el) { speaker = el.textContent.trim(); break; }
      }
      for (const ts of TEXT_SELECTORS) {
        const el = node.querySelector(ts);
        if (el) { text = el.textContent.trim(); break; }
      }

      // Fallback: use all text content split by line
      if (!text) {
        const all = node.textContent.trim();
        if (speaker && all.startsWith(speaker)) {
          text = all.slice(speaker.length).trim().replace(/^\s*:\s*/, "");
        } else {
          text = all;
        }
      }

      if (text) items.push(speaker ? `${speaker}: ${text}` : text);
    });

    if (items.length > 0) break;
  }

  return items.join("\n");
}

// ── Get meeting title from page ───────────────────────────────────────────────
function getMeetingTitle() {
  // Try Teams-specific heading first
  const heading = document.querySelector(
    '[data-tid="meeting-recap-title"], [class*="meetingTitle"], [class*="meeting-title"], h1'
  );
  if (heading) return heading.textContent.trim();
  // Fall back to page title (usually "Meeting name | Microsoft Teams")
  return document.title.replace(/\s*[|–-]\s*Microsoft Teams.*$/i, "").trim();
}

// ── Widget ────────────────────────────────────────────────────────────────────
function createWidget() {
  if (document.getElementById(WIDGET_ID)) return;

  const widget = document.createElement("div");
  widget.id = WIDGET_ID;
  widget.innerHTML = `
    <div style="
      position: fixed; bottom: 24px; right: 24px; z-index: 99999;
      background: #1e1e2e; color: white; border-radius: 14px;
      padding: 14px 16px; box-shadow: 0 8px 32px rgba(0,0,0,0.4);
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      font-size: 13px; min-width: 220px; max-width: 300px;
    ">
      <div style="display:flex;align-items:center;gap:8px;margin-bottom:10px;">
        <span style="background:#6366f1;border-radius:7px;width:26px;height:26px;display:flex;align-items:center;justify-content:center;font-size:13px;">⏱</span>
        <strong style="font-size:13px;">Clock-It</strong>
        <button id="clockit-close" style="margin-left:auto;background:none;border:none;color:#6b6b88;cursor:pointer;font-size:16px;line-height:1;">×</button>
      </div>
      <div id="clockit-status" style="color:#a0a0b8;font-size:12px;margin-bottom:10px;">
        Scanning for transcript...
      </div>
      <button id="clockit-send" style="
        width:100%;background:#6366f1;color:white;border:none;border-radius:8px;
        padding:8px 12px;font-size:12px;font-weight:600;cursor:pointer;
      " disabled>Send to Clock-It</button>
    </div>
  `;
  document.body.appendChild(widget);

  document.getElementById("clockit-close").onclick = () => widget.remove();
  document.getElementById("clockit-send").onclick = sendTranscript;
}

function setStatus(msg, color) {
  const el = document.getElementById("clockit-status");
  if (el) {
    el.textContent = msg;
    el.style.color = color || "#a0a0b8";
  }
}

// ── Send to Clock-It ──────────────────────────────────────────────────────────
async function sendTranscript() {
  const btn = document.getElementById("clockit-send");

  // Try DOM extraction first, then fall back to selected text
  let transcript = extractFromDOM();
  if (!transcript || transcript.length < 50) {
    const selected = window.getSelection()?.toString().trim();
    if (selected && selected.length > 50) {
      transcript = selected;
    }
  }

  if (!transcript || transcript.length < 50) {
    setStatus("No transcript found. Select transcript text and try again.", "#f59e0b");
    return;
  }

  const meetingLabel = getMeetingTitle();

  btn.textContent = "Sending...";
  btn.disabled = true;

  chrome.storage.local.get(["clockItUrl"], async (data) => {
    const baseUrl = (data.clockItUrl || CLOCKIT_DEFAULT).replace(/\/$/, "");

    try {
      const res = await fetch(`${baseUrl}/api/meetings/ingest`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ transcript, meetingLabel }),
      });

      if (!res.ok) throw new Error(`HTTP ${res.status}`);

      setStatus(`✓ Sent! Opening Clock-It...`, "#34d399");
      btn.textContent = "Sent ✓";

      setTimeout(() => {
        window.open(`${baseUrl}/meetings`, "_blank");
      }, 800);
    } catch {
      setStatus("Failed to reach Clock-It. Is it running?", "#f87171");
      btn.textContent = "Send to Clock-It";
      btn.disabled = false;
    }
  });
}

// ── Scan and update widget status ─────────────────────────────────────────────
function scanTranscript() {
  const transcript = extractFromDOM();
  const sendBtn = document.getElementById("clockit-send");
  if (!sendBtn) return;

  if (transcript && transcript.length > 50) {
    const lines = transcript.split("\n").filter(Boolean).length;
    setStatus(`Found ${lines} transcript line${lines !== 1 ? "s" : ""}`, "#34d399");
    sendBtn.disabled = false;
  } else {
    setStatus("No transcript yet — select transcript text to send manually", "#a0a0b8");
    sendBtn.disabled = false; // still allow sending selected text
  }
}

// ── Init ──────────────────────────────────────────────────────────────────────
function init() {
  createWidget();
  scanTranscript();

  // Re-scan as Teams loads content dynamically
  const observer = new MutationObserver(() => scanTranscript());
  observer.observe(document.body, { childList: true, subtree: true });
}

// Teams is a SPA — wait for body then init
if (document.body) {
  init();
} else {
  document.addEventListener("DOMContentLoaded", init);
}
