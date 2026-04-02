const toggle    = document.getElementById("toggle");
const urlInput  = document.getElementById("clockItUrl");
const saveBtn   = document.getElementById("saveBtn");
const statusEl  = document.getElementById("status");

// Load saved settings
chrome.storage.local.get(["clockItUrl", "enabled"], (data) => {
  urlInput.value = data.clockItUrl || "http://localhost:3000";
  toggle.checked = data.enabled !== false; // default true
});

// Toggle tracking on/off
toggle.addEventListener("change", () => {
  chrome.storage.local.set({ enabled: toggle.checked });
  showStatus(toggle.checked ? "Tracking enabled" : "Tracking paused", "ok");
});

// Save URL and test connection
saveBtn.addEventListener("click", async () => {
  const url = urlInput.value.trim().replace(/\/$/, "");
  if (!url) return;

  saveBtn.textContent = "Saving...";
  saveBtn.disabled = true;

  try {
    const res = await fetch(`${url}/api/activity/ping`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ path: "extension-test", type: "browser", title: "Connection test" }),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    chrome.storage.local.set({ clockItUrl: url });
    showStatus("Connected & saved!", "ok");
  } catch {
    showStatus("Could not reach Clock-It at that URL", "err");
  } finally {
    saveBtn.textContent = "Save";
    saveBtn.disabled = false;
  }
});

function showStatus(msg, type) {
  statusEl.textContent = msg;
  statusEl.className = `status ${type}`;
  setTimeout(() => { statusEl.textContent = ""; statusEl.className = "status"; }, 3000);
}
