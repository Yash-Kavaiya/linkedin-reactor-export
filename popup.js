document.getElementById('exportBtn').addEventListener('click', async () => {
  const btn = document.getElementById('exportBtn');
  const status = document.getElementById('status');
  const progress = document.querySelector('.progress');
  const progressBar = document.getElementById('progressBar');

  btn.disabled = true;
  btn.textContent = '⏳ Exporting...';
  status.textContent = 'Scrolling and collecting reactors...';
  status.className = '';
  progress.style.display = 'block';
  progressBar.style.width = '10%';

  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

    if (!tab.url.includes('linkedin.com')) {
      status.textContent = '❌ Please open a LinkedIn page first.';
      status.className = 'error';
      btn.disabled = false;
      btn.textContent = '⬇️ Export All Reactors';
      return;
    }

    progressBar.style.width = '30%';

    const result = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: scrapeReactors
    });

    progressBar.style.width = '80%';

    const data = result[0].result;

    if (!data || data.error) {
      status.textContent = '❌ ' + (data?.error || 'Could not find reactors. Open the reactions popup first.');
      status.className = 'error';
      btn.disabled = false;
      btn.textContent = '⬇️ Export All Reactors';
      return;
    }

    if (data.count === 0) {
      status.textContent = '⚠️ No reactors found. Make sure the popup is open and scrolled.';
      status.className = 'error';
      btn.disabled = false;
      btn.textContent = '⬇️ Export All Reactors';
      return;
    }

    // Download CSV
    const blob = new Blob([data.csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const timestamp = new Date().toISOString().slice(0,10);
    
    await chrome.downloads.download({
      url: url,
      filename: `linkedin_reactors_${timestamp}.csv`,
      saveAs: false
    });

    progressBar.style.width = '100%';
    status.textContent = `✅ Exported ${data.count} reactors!`;
    status.className = 'success';
    btn.textContent = '⬇️ Export All Reactors';
    btn.disabled = false;

  } catch (err) {
    status.textContent = '❌ Error: ' + err.message;
    status.className = 'error';
    btn.disabled = false;
    btn.textContent = '⬇️ Export All Reactors';
    progress.style.display = 'none';
  }
});

// This runs in the LinkedIn page context
async function scrapeReactors() {
  try {
    // Find the reactors modal/panel
    const modalSelectors = [
      '.social-details-reactors-tab-body-list',
      '.feed-shared-social-action-bar__reactions-list',
      '[data-test-id="social-details-reactors"]',
      '.social-details-social-activity',
    ];

    let container = null;
    for (const sel of modalSelectors) {
      container = document.querySelector(sel);
      if (container) break;
    }

    // Auto-scroll the reactors list to load all
    const scrollableSelectors = [
      '.artdeco-modal__content',
      '.social-details-reactors-tab-body-list',
      '.scaffold-finite-scroll__content',
    ];

    let scrollEl = null;
    for (const sel of scrollableSelectors) {
      const el = document.querySelector(sel);
      if (el) { scrollEl = el; break; }
    }

    if (scrollEl) {
      // Scroll to bottom incrementally to trigger lazy loading
      await new Promise(resolve => {
        let lastHeight = 0;
        let attempts = 0;
        const scroll = setInterval(() => {
          scrollEl.scrollTop += 500;
          const newHeight = scrollEl.scrollHeight;
          if (newHeight === lastHeight) {
            attempts++;
            if (attempts > 5) {
              clearInterval(scroll);
              resolve();
            }
          } else {
            attempts = 0;
            lastHeight = newHeight;
          }
        }, 400);
        // Max 15 seconds
        setTimeout(() => { clearInterval(scroll); resolve(); }, 15000);
      });
    }

    // Wait a bit for DOM to settle
    await new Promise(r => setTimeout(r, 800));

    // Extract people
    const people = [];
    const seen = new Set();

    // Try multiple selectors for reactor list items
    const itemSelectors = [
      '.social-details-reactors-tab-body-list__list-item',
      '.artdeco-list__item',
    ];

    let items = [];
    for (const sel of itemSelectors) {
      items = document.querySelectorAll(sel);
      if (items.length > 0) break;
    }

    items.forEach(el => {
      // Name
      const nameEl = el.querySelector(
        '.artdeco-entity-lockup__title, .react-button__text, span[aria-hidden="true"]'
      );
      const name = nameEl?.innerText?.trim();

      // LinkedIn profile URL
      let profileUrl = '';
      const links = el.querySelectorAll('a[href]');
      for (const link of links) {
        const href = link.href;
        if (href.includes('linkedin.com/in/') || href.includes('linkedin.com/company/')) {
          profileUrl = href.split('?')[0];
          break;
        }
      }

      // Headline / subtitle
      const subtitleEl = el.querySelector('.artdeco-entity-lockup__subtitle');
      const headline = subtitleEl?.innerText?.trim() || '';

      // Reaction type (like, celebrate, etc.)
      const reactionEl = el.querySelector('[data-reaction-type], .reactions-icon');
      const reaction = reactionEl?.getAttribute('data-reaction-type') || '';

      if (name && !seen.has(name)) {
        seen.add(name);
        people.push({ name, profileUrl, headline, reaction });
      }
    });

    if (people.length === 0) {
      return { error: 'No reactors found. Make sure the reactions popup is open.' };
    }

    // Build CSV
    const headers = 'Name,LinkedIn URL,Headline,Reaction';
    const rows = people.map(p =>
      `"${p.name.replace(/"/g, '""')}","${p.profileUrl}","${p.headline.replace(/"/g, '""')}","${p.reaction}"`
    );
    const csv = [headers, ...rows].join('\n');

    return { count: people.length, csv };

  } catch (e) {
    return { error: e.message };
  }
}
