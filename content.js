// LinkedIn Reactor Exporter Pro - Content Script v2.1.0

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
  const posts = document.querySelectorAll(
    '.feed-shared-update-v2:not([data-lre-injected]), .occludable-update:not([data-lre-injected])'
  );

  posts.forEach(post => {
    post.setAttribute('data-lre-injected', '1');
    post.style.position = 'relative';

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

      const postLink = post.querySelector('a[href*="activity"]');
      const postUrl = postLink ? postLink.href.split('?')[0] : window.location.href;

      chrome.runtime.sendMessage({
        action: 'triggerExport',
        postUrl,
        postElement: true
      });

      showToast('Opening exporter... click the extension icon 💼');
    });

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

// ── ROBUST MODAL FINDER ──
// Finds the open reactions modal/dialog regardless of LinkedIn's current class names
function findReactorsModal() {
  // Priority order: most specific to most generic
  const candidates = [
    // Classic selectors (may still work in some regions)
    document.querySelector('.social-details-reactors-tab-body-list'),
    document.querySelector('.social-details-reactors-modal .scaffold-finite-scroll__content'),
    document.querySelector('.artdeco-modal .scaffold-finite-scroll__content'),
    // Structural selectors (role-based, more stable)
    document.querySelector('[role="dialog"] .scaffold-finite-scroll__content'),
    document.querySelector('[role="dialog"] [role="list"]'),
    document.querySelector('[role="dialog"] ul'),
    // Broad modal content
    document.querySelector('[role="dialog"] .artdeco-modal__content'),
    document.querySelector('[data-test-modal]'),
    document.querySelector('[role="dialog"]'),
  ];
  return candidates.find(Boolean) || null;
}

// ── ROBUST ITEM EXTRACTOR ──
// Finds reactor list items from a container regardless of class names
function findReactorItems(container) {
  if (!container) return [];

  // Try specific selectors first
  const specificSelectors = [
    '.social-details-reactors-tab-body-list__list-item',
    '.social-details-reactors-list .artdeco-list__item',
    '.artdeco-list__item',
  ];
  for (const sel of specificSelectors) {
    const items = container.querySelectorAll(sel);
    if (items.length > 0) return Array.from(items);
  }

  // Role-based (stable)
  const roleItems = container.querySelectorAll('[role="listitem"]');
  if (roleItems.length > 0) return Array.from(roleItems);

  // li elements containing a LinkedIn profile link
  const liItems = Array.from(container.querySelectorAll('li')).filter(li =>
    li.querySelector('a[href*="linkedin.com/in/"], a[href*="linkedin.com/company/"]')
  );
  if (liItems.length > 0) return liItems;

  // Last resort: group by parent element around profile links
  const seen = new Set();
  const items = [];
  container.querySelectorAll('a[href*="linkedin.com/in/"], a[href*="linkedin.com/company/"]').forEach(link => {
    // Walk up to find a reasonable container (li, or an element with data-urn, or 3 levels up)
    let el = link.closest('li') ||
             link.closest('[data-urn]') ||
             link.parentElement?.parentElement?.parentElement;
    if (el && !seen.has(el)) {
      seen.add(el);
      items.push(el);
    }
  });
  return items;
}

// ── PERSON EXTRACTOR ──
function extractPerson(el) {
  const nameSelectors = [
    // Specific selectors
    '.artdeco-entity-lockup__title span[aria-hidden="true"]',
    '.artdeco-entity-lockup__title',
    '.comments-post-meta__name-text',
    '.update-components-actor__name span[aria-hidden="true"]',
    // LinkedIn anonymization attributes (stable across redesigns)
    '[data-anonymize="person-name"]',
    '[data-anonymize="name"]',
    // Common patterns
    '.hoverable-link-text',
    // Broad: any span with aria-hidden inside (LinkedIn pattern for screen-reader duplicates)
    'span[aria-hidden="true"]',
  ];

  let name = '';
  for (const sel of nameSelectors) {
    const found = el.querySelector(sel);
    const text = found?.innerText?.trim();
    if (text && text.length > 1) { name = text; break; }
  }

  // Last resort: extract from profile link text or aria-label
  if (!name) {
    const profileLink = el.querySelector('a[href*="linkedin.com/in/"], a[href*="linkedin.com/company/"]');
    name = profileLink?.innerText?.trim() ||
           profileLink?.getAttribute('aria-label')?.replace(/^View /, '') || '';
  }

  if (!name) return null;

  // Profile URL
  let profileUrl = '';
  for (const link of el.querySelectorAll('a[href]')) {
    const href = link.href || '';
    if (href.includes('linkedin.com/in/') || href.includes('linkedin.com/company/')) {
      profileUrl = href.split('?')[0];
      break;
    }
  }

  // Headline
  const headlineSelectors = [
    '.artdeco-entity-lockup__subtitle',
    '.comments-post-meta__headline',
    '.update-components-actor__description',
    '[data-anonymize="headline"]',
    '[data-anonymize="person-headline"]',
  ];
  let headline = '';
  for (const sel of headlineSelectors) {
    const text = el.querySelector(sel)?.innerText?.trim();
    if (text) { headline = text; break; }
  }

  return { name, profileUrl, headline };
}

// ── REACTION TYPE EXTRACTOR ──
function extractReactionType(el) {
  const reactionEl = el.querySelector(
    '[data-reaction-type], .reactions-icon__consumption, [aria-label*="reaction"], [class*="reaction"]'
  );
  if (!reactionEl) return 'LIKE';

  return reactionEl.getAttribute('data-reaction-type') ||
         reactionEl.getAttribute('aria-label') ||
         reactionEl.className.match(/reaction[_-](\w+)/i)?.[1]?.toUpperCase() ||
         'LIKE';
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

// ── MAIN SCRAPING FUNCTION ──
window.__lre_scrape = async function({ includeCommenters = true, autoScroll = true } = {}) {
  try {
    const results = {
      reactors: [],
      commenters: [],
      postUrl: window.location.href,
      postTitle: document.title
    };

    // ── REACTORS ──
    const reactorModal = findReactorsModal();

    if (!reactorModal) {
      return { error: 'Reactions popup not found. Please click the reaction count on a LinkedIn post to open the popup first, then try again.' };
    }

    if (autoScroll) {
      await autoScrollEl(reactorModal);
    }

    const reactorItems = findReactorItems(reactorModal);
    const seen = new Set();

    reactorItems.forEach(el => {
      const person = extractPerson(el);
      if (person && !seen.has(person.name)) {
        seen.add(person.name);
        person.reactionType = extractReactionType(el);
        results.reactors.push(person);
      }
    });

    // ── COMMENTERS ──
    if (includeCommenters) {
      const commentContainerSelectors = [
        '.comments-comments-list',
        '.feed-shared-update-v2__comments-container',
        '.comments-container',
        '[data-test-id="comments-container"]',
      ];
      let commentsContainer = null;
      for (const sel of commentContainerSelectors) {
        commentsContainer = document.querySelector(sel);
        if (commentsContainer) break;
      }

      if (commentsContainer && autoScroll) {
        await autoScrollEl(commentsContainer);
      }

      const commentItemSelectors = [
        '.comments-comment-item',
        '.comment-item',
        '.comments-comment-list__item',
        '[data-urn*="comment"]',
      ];
      let commentEls = [];
      for (const sel of commentItemSelectors) {
        const found = document.querySelectorAll(sel);
        if (found.length > 0) { commentEls = Array.from(found); break; }
      }

      const commentSeen = new Set();
      commentEls.forEach(el => {
        const person = extractPerson(el);
        if (person && !commentSeen.has(person.name)) {
          commentSeen.add(person.name);
          const commentTextSelectors = [
            '.comments-comment-item__main-content',
            '.comment-content',
            '.comments-comment-item-content-body',
            '[data-test-id="comment-content"]',
          ];
          let commentText = '';
          for (const sel of commentTextSelectors) {
            commentText = el.querySelector(sel)?.innerText?.trim() || '';
            if (commentText) break;
          }
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

// Listen from popup
chrome.runtime.onMessage.addListener((req, sender, sendResponse) => {
  if (req.action === 'ping') sendResponse({ ok: true, url: window.location.href });
  if (req.action === 'scrape') {
    window.__lre_scrape(req.options).then(sendResponse);
    return true;
  }
});
