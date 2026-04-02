const DEFAULT_CLOCKIT_URL = "http://localhost:3000";

// URLs that should never be logged
function shouldTrack(url) {
  if (!url) return false;
  if (url.startsWith("chrome://")) return false;
  if (url.startsWith("chrome-extension://")) return false;
  if (url.startsWith("edge://")) return false;
  if (url.startsWith("about:")) return false;
  if (url.startsWith("moz-extension://")) return false;
  if (url === "newtab") return false;
  return true;
}

chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  // Only fire once the page has fully loaded
  if (changeInfo.status !== "complete") return;
  if (!shouldTrack(tab.url)) return;

  chrome.storage.local.get(["clockItUrl", "enabled"], (data) => {
    // Default to enabled
    if (data.enabled === false) return;

    const baseUrl = (data.clockItUrl || DEFAULT_CLOCKIT_URL).replace(/\/$/, "");

    fetch(`${baseUrl}/api/activity/ping`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        path: tab.url,
        title: tab.title ?? "",
        type: "browser",
      }),
    }).catch(() => {
      // Clock-It might not be running — fail silently
    });
  });
});
