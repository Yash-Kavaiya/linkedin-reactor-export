// LinkedIn Reactor Exporter Pro - Content Script

let settings = { showFloatingButton: true };

// Load settings
chrome.storage.sync.get(['showFloatingButton'], (result) => {
  settings = { ...settings, ...result };
  if (settings.showFloatingButton) {
    observePosts();
  }
});

// Listen for settings changes
chrome.storage.onChanged.addListener((changes) => {
  if (changes.showFloatingButton) {
    settings.showFloatingButton = changes.showFloatingButton.newValue;
    if (!settings.showFloatingButton) {
      document.querySelectorAll('.lre-floating-btn').forEach(b => b.remove());
    } else {
      observePosts();
    }
  }
});

// Observe DOM for new posts
function observePosts() {
  const observer = new MutationObserver(() => injectButtons());
  observer.observe(document.body, { childList: true, subtree: true });
  injectButtons();
}

function injectButtons() {
  // LinkedIn post articles
  const posts = document.querySelectorAll(
    '.feed-shared-update-v2:not([data-lre-injected]), .occludable-update:not([data-lre-injected])'
  );

  posts.forEach(post => {
    post.setAttribute('data-lre-injected', '1');
    post.style.position = 'relative';

    // Find the social action bar to position near it
    const actionBar = post.querySelector('.feed-shared-social-action-bar, .social-actions-button');
    if (!actionBar) return;

    const btn = document.createElement('button');
    btn.className = 'lre-floating-btn';
    btn.title = 'Export Reactors & Commenters';
    btn.innerHTML = `
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/>
        <polyline points="7 10 12 15 17 10"/>
        <line x1="12" y1="15" x2="12" y2="3"/>
      </svg>
      Export
    `;

    btn.addEventListener('click', async (e) => {
      e.stopPropagation();
      e.preventDefault();

      // Get post URL
      const postLink = post.querySelector('a[href*="activity"]');
      const postUrl = postLink ? postLink.href.split('?')[0] : window.location.href;

      // Send message to popup to trigger export, or do it inline
      chrome.runtime.sendMessage({
        action: 'triggerExport',
        postUrl,
        postElement: true
      });

      showToast('Opening exporter... click the extension icon 💼');
    });

    // Insert after action bar
    actionBar.parentNode.style.position = 'relative';
    actionBar.parentNode.appendChild(btn);
  });
}

// Toast notification
function showToast(msg, isError = false) {
  let toast = document.querySelector('.lre-toast');
  if (!toast) {
    toast = document.createElement('div');
    toast.className = 'lre-toast';
    document.body.appendChild(toast);
  }
  toast.textContent = msg;
  toast.className = 'lre-toast' + (isError ? ' error' : '');
  setTimeout(() => toast.classList.add('show'), 10);
  setTimeout(() => toast.classList.remove('show'), 3000);
}

// Main scraping function - called from popup via executeScript
window.__lre_scrape = async function({ includeCommenters = true, autoScroll = true } = {}) {
  try {
    const results = {
      reactors: [],
      commenters: [],
      postUrl: window.location.href,
      postTitle: document.title
    };

    // ── REACTORS ──
    const reactorModal = document.querySelector(
      '.social-details-reactors-tab-body-list, .artdeco-modal .scaffold-finite-scroll__content'
    );

    if (reactorModal && autoScroll) {
      await autoScrollEl(reactorModal);
    }

    const reactorItems = document.querySelectorAll(
      '.social-details-reactors-tab-body-list__list-item, .social-details-reactors-list .artdeco-list__item'
    );

    const seen = new Set();
    reactorItems.forEach(el => {
      const person = extractPerson(el);
      if (person && !seen.has(person.name)) {
        seen.add(person.name);
        // Try to get reaction type
        const reactionIcon = el.querySelector('[data-reaction-type], .reactions-icon__consumption');
        person.reactionType = reactionIcon?.getAttribute('data-reaction-type') || 
                              reactionIcon?.getAttribute('aria-label') || 'Like';
        results.reactors.push(person);
      }
    });

    // ── COMMENTERS ──
    if (includeCommenters) {
      // Scroll comments area
      const commentsContainer = document.querySelector(
        '.comments-comments-list, .feed-shared-update-v2__comments-container'
      );
      if (commentsContainer && autoScroll) {
        await autoScrollEl(commentsContainer);
      }

      const commentEls = document.querySelectorAll(
        '.comments-comment-item, .comment-item'
      );

      const commentSeen = new Set();
      commentEls.forEach(el => {
        const person = extractPerson(el);
        if (person && !commentSeen.has(person.name)) {
          commentSeen.add(person.name);
          // Get comment text
          const commentText = el.querySelector('.comments-comment-item__main-content, .comment-content')?.innerText?.trim() || '';
          person.commentText = commentText.slice(0, 200);
          results.commenters.push(person);
        }
      });
    }

    return results;

  } catch (e) {
    return { error: e.message };
  }
};

function extractPerson(el) {
  const nameSelectors = [
    '.artdeco-entity-lockup__title span[aria-hidden="true"]',
    '.artdeco-entity-lockup__title',
    '.comments-post-meta__name-text',
    '.update-components-actor__name span[aria-hidden="true"]'
  ];
  let name = '';
  for (const sel of nameSelectors) {
    name = el.querySelector(sel)?.innerText?.trim();
    if (name) break;
  }
  if (!name) return null;

  let profileUrl = '';
  const links = el.querySelectorAll('a[href]');
  for (const link of links) {
    const href = link.href;
    if (href.includes('linkedin.com/in/') || href.includes('linkedin.com/company/')) {
      profileUrl = href.split('?')[0];
      break;
    }
  }

  const headline = el.querySelector(
    '.artdeco-entity-lockup__subtitle, .comments-post-meta__headline, .update-components-actor__description'
  )?.innerText?.trim() || '';

  return { name, profileUrl, headline };
}

async function autoScrollEl(el) {
  return new Promise(resolve => {
    let lastH = 0, stalls = 0;
    const iv = setInterval(() => {
      el.scrollTop += 600;
      if (el.scrollHeight === lastH) {
        stalls++;
        if (stalls >= 4) { clearInterval(iv); resolve(); }
      } else {
        stalls = 0;
        lastH = el.scrollHeight;
      }
    }, 350);
    setTimeout(() => { clearInterval(iv); resolve(); }, 20000);
  });
}

// Listen from popup
chrome.runtime.onMessage.addListener((req, sender, sendResponse) => {
  if (req.action === 'ping') sendResponse({ ok: true, url: window.location.href });
  if (req.action === 'scrape') {
    window.__lre_scrape(req.options).then(sendResponse);
    return true;
  }
});
