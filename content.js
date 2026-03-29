// Content script — runs on LinkedIn pages
// Listens for messages from popup if needed

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'ping') {
    sendResponse({ status: 'ok' });
  }
});
