// LinkedIn Reactor Exporter Pro - Popup Script

let lastExportData = null;
let selectedFormat = 'csv';
let selectedReaction = 'all';

// ── INIT ──
document.addEventListener('DOMContentLoaded', async () => {
  loadSettings();
  setupTabs();
  setupFormatPills();
  setupReactionFilters();
  checkPage();
  loadHistory();

  document.getElementById('exportBtn').addEventListener('click', runExport);
  document.getElementById('copyCSVBtn').addEventListener('click', copyCSV);
  document.getElementById('copyJSONBtn').addEventListener('click', copyJSON);
  document.getElementById('downloadAgainBtn').addEventListener('click', downloadAgain);
  document.getElementById('clearHistoryBtn').addEventListener('click', clearHistory);
  document.getElementById('optionsBtn').addEventListener('click', () => chrome.runtime.openOptionsPage());
});

// ── SETTINGS ──
function loadSettings() {
  chrome.storage.sync.get(['autoScroll', 'defaultFormat'], (s) => {
    if (s.autoScroll !== undefined) document.getElementById('autoScroll').checked = s.autoScroll;
    if (s.defaultFormat) activateFormat(s.defaultFormat);
  });
  document.getElementById('autoScroll').addEventListener('change', (e) => {
    chrome.storage.sync.set({ autoScroll: e.target.checked });
  });
  document.getElementById('includeCommenters').addEventListener('change', (e) => {
    chrome.storage.sync.set({ includeCommenters: e.target.checked });
  });
}

// ── TABS ──
function setupTabs() {
  document.querySelectorAll('.tab').forEach(tab => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
      document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
      tab.classList.add('active');
      document.getElementById('tab-' + tab.dataset.tab).classList.add('active');
      if (tab.dataset.tab === 'history') loadHistory();
    });
  });
}

// ── FORMAT PILLS ──
function setupFormatPills() {
  document.querySelectorAll('.format-pill').forEach(pill => {
    pill.addEventListener('click', () => activateFormat(pill.dataset.format));
  });
}
function activateFormat(fmt) {
  selectedFormat = fmt;
  document.querySelectorAll('.format-pill').forEach(p => {
    p.classList.toggle('active', p.dataset.format === fmt);
  });
}

// ── REACTION FILTERS ──
function setupReactionFilters() {
  document.querySelectorAll('.reaction-chip').forEach(chip => {
    chip.addEventListener('click', () => {
      document.querySelectorAll('.reaction-chip').forEach(c => c.classList.remove('active'));
      chip.classList.add('active');
      selectedReaction = chip.dataset.reaction;
    });
  });
}

// ── CHECK PAGE ──
async function checkPage() {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab.url?.includes('linkedin.com')) {
      document.getElementById('notLinkedIn').style.display = 'block';
      document.getElementById('exportUI').style.display = 'none';
    }
  } catch {}
}

// ── MAIN EXPORT ──
async function runExport() {
  const btn = document.getElementById('exportBtn');
  setProgress(0, 'Connecting to LinkedIn...');
  showProgress(true);
  setStatus('');
  btn.disabled = true;
  btn.textContent = '⏳ Exporting...';
  document.getElementById('quickActions').style.display = 'none';

  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

    if (!tab.url?.includes('linkedin.com')) {
      throw new Error('Please open a LinkedIn page first.');
    }

    setProgress(20, 'Injecting scraper...');

    // Execute scraping in page context
    const opts = {
      includeCommenters: document.getElementById('includeCommenters').checked,
      autoScroll: document.getElementById('autoScroll').checked
    };

    const results = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: async (options) => {
        if (typeof window.__lre_scrape === 'function') {
          return await window.__lre_scrape(options);
        }
        // Fallback inline scraper (robust — mirrors content.js v2.1.0 logic)
        return await (async function({ includeCommenters, autoScroll }) {
          async function autoScrollEl(el) {
            return new Promise(resolve => {
              let lastH = 0, stalls = 0;
              const iv = setInterval(() => {
                el.scrollTop += 600;
                if (el.scrollHeight === lastH) {
                  stalls++;
                  if (stalls >= 4) { clearInterval(iv); resolve(); }
                } else { stalls = 0; lastH = el.scrollHeight; }
              }, 350);
              setTimeout(() => { clearInterval(iv); resolve(); }, 20000);
            });
          }

          function findReactorsModal() {
            return document.querySelector('.social-details-reactors-tab-body-list') ||
                   document.querySelector('.social-details-reactors-modal .scaffold-finite-scroll__content') ||
                   document.querySelector('.artdeco-modal .scaffold-finite-scroll__content') ||
                   document.querySelector('[role="dialog"] .scaffold-finite-scroll__content') ||
                   document.querySelector('[role="dialog"] [role="list"]') ||
                   document.querySelector('[role="dialog"] ul') ||
                   document.querySelector('[role="dialog"] .artdeco-modal__content') ||
                   document.querySelector('[data-test-modal]') ||
                   document.querySelector('[role="dialog"]');
          }

          function findReactorItems(container) {
            if (!container) return [];
            for (const sel of ['.social-details-reactors-tab-body-list__list-item', '.social-details-reactors-list .artdeco-list__item', '.artdeco-list__item']) {
              const items = container.querySelectorAll(sel);
              if (items.length > 0) return Array.from(items);
            }
            const roleItems = container.querySelectorAll('[role="listitem"]');
            if (roleItems.length > 0) return Array.from(roleItems);
            const liItems = Array.from(container.querySelectorAll('li')).filter(li =>
              li.querySelector('a[href*="linkedin.com/in/"], a[href*="linkedin.com/company/"]')
            );
            if (liItems.length > 0) return liItems;
            const seenEls = new Set(); const items = [];
            container.querySelectorAll('a[href*="linkedin.com/in/"], a[href*="linkedin.com/company/"]').forEach(link => {
              let el = link.closest('li') || link.closest('[data-urn]') || link.parentElement?.parentElement?.parentElement;
              if (el && !seenEls.has(el)) { seenEls.add(el); items.push(el); }
            });
            return items;
          }

          function extractPerson(el) {
            let name = '';
            for (const sel of [
              '.artdeco-entity-lockup__title span[aria-hidden="true"]',
              '.artdeco-entity-lockup__title',
              '.comments-post-meta__name-text',
              '[data-anonymize="person-name"]',
              '[data-anonymize="name"]',
              '.hoverable-link-text',
              'span[aria-hidden="true"]'
            ]) {
              const text = el.querySelector(sel)?.innerText?.trim();
              if (text && text.length > 1) { name = text; break; }
            }
            if (!name) {
              const pl = el.querySelector('a[href*="linkedin.com/in/"], a[href*="linkedin.com/company/"]');
              name = pl?.innerText?.trim() || pl?.getAttribute('aria-label')?.replace(/^View /, '') || '';
            }
            if (!name) return null;
            let profileUrl = '';
            for (const link of el.querySelectorAll('a[href]')) {
              if (link.href.includes('linkedin.com/in/') || link.href.includes('linkedin.com/company/')) {
                profileUrl = link.href.split('?')[0]; break;
              }
            }
            let headline = '';
            for (const sel of ['.artdeco-entity-lockup__subtitle', '.comments-post-meta__headline', '[data-anonymize="headline"]', '[data-anonymize="person-headline"]']) {
              const text = el.querySelector(sel)?.innerText?.trim();
              if (text) { headline = text; break; }
            }
            return { name, profileUrl, headline };
          }

          function extractReactionType(el) {
            const re = el.querySelector('[data-reaction-type], .reactions-icon__consumption, [aria-label*="reaction"], [class*="reaction"]');
            if (!re) return 'LIKE';
            return re.getAttribute('data-reaction-type') || re.getAttribute('aria-label') ||
                   (re.className.match(/reaction[_-](\w+)/i) || [])[1]?.toUpperCase() || 'LIKE';
          }

          const reactorModal = findReactorsModal();
          if (!reactorModal) return { error: 'Reactions popup not found. Please click the reaction count on the post to open the popup first.' };
          if (autoScroll) await autoScrollEl(reactorModal);

          const seen = new Set();
          const reactors = [];
          findReactorItems(reactorModal).forEach(el => {
            const p = extractPerson(el);
            if (p && !seen.has(p.name)) {
              seen.add(p.name);
              p.reactionType = extractReactionType(el);
              reactors.push(p);
            }
          });

          const commenters = [];
          if (includeCommenters) {
            let cc = null;
            for (const sel of ['.comments-comments-list', '.feed-shared-update-v2__comments-container', '.comments-container', '[data-test-id="comments-container"]']) {
              cc = document.querySelector(sel);
              if (cc) break;
            }
            if (cc && autoScroll) await autoScrollEl(cc);
            let commentEls = [];
            for (const sel of ['.comments-comment-item', '.comment-item', '.comments-comment-list__item', '[data-urn*="comment"]']) {
              const found = document.querySelectorAll(sel);
              if (found.length > 0) { commentEls = Array.from(found); break; }
            }
            const cs = new Set();
            commentEls.forEach(el => {
              const p = extractPerson(el);
              if (p && !cs.has(p.name)) {
                cs.add(p.name);
                let ct = '';
                for (const sel of ['.comments-comment-item__main-content', '.comment-content', '.comments-comment-item-content-body']) {
                  ct = el.querySelector(sel)?.innerText?.trim() || '';
                  if (ct) break;
                }
                p.commentText = ct.slice(0, 200);
                commenters.push(p);
              }
            });
          }

          return { reactors, commenters, postUrl: window.location.href, postTitle: document.title };
        })(options);
      },
      args: [opts]
    });

    setProgress(70, 'Processing data...');
    const data = results[0].result;

    if (!data || data.error) throw new Error(data?.error || 'No data returned. Make sure the reactions popup is open.');

    // Apply reaction filter
    let reactors = data.reactors || [];
    if (selectedReaction !== 'all') {
      reactors = reactors.filter(r => r.reactionType?.toUpperCase() === selectedReaction);
    }

    if (reactors.length === 0 && (data.commenters || []).length === 0) {
      throw new Error('No reactors found. Make sure you clicked the reaction count (e.g. "98 reactions") on the post to open the reactions popup, then try again. If this persists, LinkedIn may have updated their layout — please report it at github.com/Yash-Kavaiya/linkedin-reactor-export/issues');
    }

    setProgress(85, 'Building export files...');

    const csvContent = buildCSV(reactors, data.commenters || []);
    const jsonContent = buildJSON(reactors, data.commenters || [], data);

    lastExportData = { csv: csvContent, json: jsonContent, reactors, commenters: data.commenters || [], data };

    // Download based on format
    if (selectedFormat === 'csv' || selectedFormat === 'both') downloadFile(csvContent, 'text/csv', 'linkedin_reactors.csv');
    if (selectedFormat === 'json' || selectedFormat === 'both') downloadFile(jsonContent, 'application/json', 'linkedin_reactors.json');

    setProgress(100, 'Done!');

    // Save to history
    chrome.runtime.sendMessage({
      action: 'saveToHistory',
      data: {
        postUrl: data.postUrl,
        postTitle: data.postTitle || 'LinkedIn Post',
        count: reactors.length,
        commentCount: (data.commenters || []).length,
        csv: csvContent,
        json: jsonContent
      }
    });

    const total = reactors.length + (data.commenters || []).length;
    setStatus(`✅ Exported ${reactors.length} reactors + ${(data.commenters||[]).length} commenters (${total} total)`, 'success');
    document.getElementById('quickActions').style.display = 'flex';

    // Update analytics
    updateAnalytics(reactors, data.commenters || []);

  } catch (err) {
    setStatus('❌ ' + err.message, 'error');
  } finally {
    btn.disabled = false;
    btn.innerHTML = '⬇️ Export All Reactors';
    setTimeout(() => showProgress(false), 1000);
  }
}

// ── BUILD CSV ──
function buildCSV(reactors, commenters) {
  const esc = s => `"${(s || '').replace(/"/g, '""')}"`;
  const lines = ['Type,Name,LinkedIn URL,Headline,Reaction,Comment'];
  reactors.forEach(r => {
    lines.push([esc('Reactor'), esc(r.name), esc(r.profileUrl), esc(r.headline), esc(r.reactionType || 'Like'), ''].join(','));
  });
  commenters.forEach(c => {
    lines.push([esc('Commenter'), esc(c.name), esc(c.profileUrl), esc(c.headline), '', esc(c.commentText || '')].join(','));
  });
  return lines.join('\n');
}

// ── BUILD JSON ──
function buildJSON(reactors, commenters, meta) {
  return JSON.stringify({
    exported_at: new Date().toISOString(),
    post_url: meta.postUrl,
    post_title: meta.postTitle,
    summary: {
      total_reactors: reactors.length,
      total_commenters: commenters.length,
      total_unique: new Set([...reactors, ...commenters].map(p => p.name)).size
    },
    reactors,
    commenters
  }, null, 2);
}

// ── DOWNLOAD ──
function downloadFile(content, mimeType, filename) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const ts = new Date().toISOString().slice(0, 10);
  chrome.downloads.download({ url, filename: `${ts}_${filename}`, saveAs: false });
}

// ── COPY ──
async function copyCSV() {
  if (!lastExportData) return;
  await navigator.clipboard.writeText(lastExportData.csv);
  flashBtn('copyCSVBtn', '✅ Copied!');
}
async function copyJSON() {
  if (!lastExportData) return;
  await navigator.clipboard.writeText(lastExportData.json);
  flashBtn('copyJSONBtn', '✅ Copied!');
}
async function downloadAgain() {
  if (!lastExportData) return;
  downloadFile(lastExportData.csv, 'text/csv', 'linkedin_reactors.csv');
}
function flashBtn(id, text) {
  const btn = document.getElementById(id);
  const orig = btn.textContent;
  btn.textContent = text;
  setTimeout(() => btn.textContent = orig, 1500);
}

// ── ANALYTICS ──
function updateAnalytics(reactors, commenters) {
  document.getElementById('analyticsEmpty').style.display = 'none';
  document.getElementById('analyticsContent').style.display = 'block';

  const all = [...reactors, ...commenters];
  const unique = new Set(all.map(p => p.name)).size;
  const withUrl = all.filter(p => p.profileUrl).length;

  document.getElementById('statTotal').textContent = reactors.length;
  document.getElementById('statCommenters').textContent = commenters.length;
  document.getElementById('statUnique').textContent = unique;
  document.getElementById('statWithUrl').textContent = withUrl;

  // Reaction breakdown
  const reactionMap = {};
  const emojiMap = { LIKE: '👍', PRAISE: '👏', EMPATHY: '❤️', INTEREST: '💡', APPRECIATION: '🙌', ENTERTAINMENT: '😄' };
  reactors.forEach(r => {
    const key = r.reactionType || 'LIKE';
    reactionMap[key] = (reactionMap[key] || 0) + 1;
  });
  const maxR = Math.max(...Object.values(reactionMap), 1);
  const barsEl = document.getElementById('reactionBars');
  barsEl.innerHTML = '';
  Object.entries(reactionMap).sort((a,b) => b[1]-a[1]).forEach(([type, count]) => {
    barsEl.innerHTML += `
      <div class="reaction-bar-item">
        <span class="reaction-emoji">${emojiMap[type] || '👍'}</span>
        <div class="reaction-bar-wrap"><div class="reaction-bar-fill" style="width:${(count/maxR*100).toFixed(0)}%"></div></div>
        <span class="reaction-count">${count}</span>
      </div>`;
  });
  if (!Object.keys(reactionMap).length) barsEl.innerHTML = '<p style="color:#888;font-size:12px">No reaction data available</p>';

  // Top reactors (first 5)
  const topEl = document.getElementById('topReactors');
  topEl.innerHTML = '';
  reactors.slice(0, 5).forEach((r, i) => {
    topEl.innerHTML += `
      <li>
        <span class="top-num">${i + 1}</span>
        <span class="top-name">${r.name}</span>
        ${r.profileUrl ? `<a class="top-link" href="${r.profileUrl}" target="_blank">View →</a>` : ''}
      </li>`;
  });
  if (!reactors.length) topEl.innerHTML = '<li style="color:#888;font-size:12px">No data yet</li>';
}

// ── HISTORY ──
async function loadHistory() {
  const history = await new Promise(resolve => chrome.runtime.sendMessage({ action: 'getHistory' }, resolve));

  const listEl = document.getElementById('historyList');
  const emptyEl = document.getElementById('historyEmpty');
  const clearBtn = document.getElementById('clearHistoryBtn');

  listEl.innerHTML = '';

  if (!history || history.length === 0) {
    emptyEl.style.display = 'block';
    clearBtn.style.display = 'none';
    return;
  }

  emptyEl.style.display = 'none';
  clearBtn.style.display = 'block';

  history.forEach(item => {
    const date = new Date(item.timestamp);
    const dateStr = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
    const title = (item.postTitle || 'LinkedIn Post').slice(0, 50);
    const url = item.postUrl || '#';

    const div = document.createElement('div');
    div.className = 'history-item';
    div.innerHTML = `
      <div class="history-header">
        <div class="history-title"><a href="${url}" target="_blank" style="color:#0a66c2;text-decoration:none">${title}</a></div>
        <div class="history-date">${dateStr}</div>
      </div>
      <div class="history-meta">👥 ${item.count} reactors · 💬 ${item.commentCount || 0} commenters</div>
      <div class="history-actions">
        <button class="history-btn" data-action="csv" data-id="${item.id}">⬇️ CSV</button>
        <button class="history-btn" data-action="json" data-id="${item.id}">⬇️ JSON</button>
        <button class="history-btn" data-action="copy" data-id="${item.id}">📋 Copy</button>
      </div>`;

    div.querySelectorAll('.history-btn').forEach(btn => {
      btn.addEventListener('click', () => handleHistoryAction(btn.dataset.action, item));
    });

    listEl.appendChild(div);
  });
}

function handleHistoryAction(action, item) {
  if (action === 'csv') downloadFile(item.csv, 'text/csv', 'linkedin_reactors.csv');
  if (action === 'json') downloadFile(item.json, 'application/json', 'linkedin_reactors.json');
  if (action === 'copy') navigator.clipboard.writeText(item.csv);
}

async function clearHistory() {
  if (!confirm('Clear all export history?')) return;
  await new Promise(resolve => chrome.runtime.sendMessage({ action: 'clearHistory' }, resolve));
  loadHistory();
}

// ── UI HELPERS ──
function setProgress(pct, label) {
  document.getElementById('progressFill').style.width = pct + '%';
  document.getElementById('progressLabel').textContent = label;
}
function showProgress(show) {
  document.getElementById('progressWrap').style.display = show ? 'block' : 'none';
}
function setStatus(msg, type = '') {
  const el = document.getElementById('statusBar');
  el.textContent = msg;
  el.className = 'status-bar' + (type ? ' ' + type : '');
}
