// Background service worker

chrome.runtime.onInstalled.addListener(() => {
  console.log('LinkedIn Reactor Exporter Pro installed');
  // Set default settings
  chrome.storage.sync.set({
    autoScroll: true,
    defaultFormat: 'csv',
    showFloatingButton: true,
    maxHistory: 50
  });
});

// Handle messages from content script / popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'saveToHistory') {
    saveExportHistory(request.data).then(sendResponse);
    return true;
  }
  if (request.action === 'getHistory') {
    getExportHistory().then(sendResponse);
    return true;
  }
  if (request.action === 'clearHistory') {
    chrome.storage.local.remove('exportHistory', () => sendResponse({ ok: true }));
    return true;
  }
});

async function saveExportHistory(data) {
  const result = await chrome.storage.local.get('exportHistory');
  const history = result.exportHistory || [];
  history.unshift({
    id: Date.now(),
    postUrl: data.postUrl,
    postTitle: data.postTitle,
    count: data.count,
    commentCount: data.commentCount || 0,
    timestamp: new Date().toISOString(),
    csv: data.csv,
    json: data.json
  });
  // Keep last 50
  const trimmed = history.slice(0, 50);
  await chrome.storage.local.set({ exportHistory: trimmed });
  return { ok: true };
}

async function getExportHistory() {
  const result = await chrome.storage.local.get('exportHistory');
  return result.exportHistory || [];
}
