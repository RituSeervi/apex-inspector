// APEX Inspector — background service worker (Manifest V3)
// On toolbar click, inject inspector.js into the page's MAIN world
// so it can access the page's `apex` JavaScript API directly.

chrome.action.onClicked.addListener(async (tab) => {
  if (!tab.id || !/^https?:/.test(tab.url || "")) return;
  try {
    await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      world: "MAIN",          // page context → window.apex is visible
      files: ["inspector.js"]
    });
  } catch (e) {
    console.error("APEX Inspector injection failed:", e);
  }
});
