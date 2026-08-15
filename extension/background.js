/* =============================================================================
 * GovMatch Autofill — background.js  (MV3 service worker)
 * =============================================================================
 * Kept intentionally small. It has NO DOM and NO localStorage — it uses
 * chrome.storage. Its jobs:
 *   - Set sane defaults on install.
 *   - Provide a fallback that injects the content script if a page loaded before
 *     the extension (so the popup's "Autofill this page" always has a receiver).
 * ============================================================================= */

chrome.runtime.onInstalled.addListener(function () {
  chrome.storage.local.get(["govmatch_lang"], function (res) {
    if (!res.govmatch_lang) {
      chrome.storage.local.set({ govmatch_lang: "en" });
    }
  });
});

// Fallback injection requested by the popup when the content script isn't present.
chrome.runtime.onMessage.addListener(function (msg, _sender, sendResponse) {
  if (msg && msg.type === "GOVMATCH_ENSURE_CONTENT" && msg.tabId) {
    chrome.scripting.executeScript(
      {
        target: { tabId: msg.tabId },
        files: ["fieldMap.js", "content.js"],
      },
      function () {
        var err = chrome.runtime.lastError;
        sendResponse({ ok: !err, error: err ? err.message : null });
      }
    );
    return true; // async response
  }
});
