/**
 * Google Calendar URL Retriever — Content Script
 *
 * Observes DOM changes to detect event detail popups in Google Calendar,
 * injects a "コピー" button, and copies event date + meeting URL to clipboard.
 */
(function () {
  'use strict';

  const warn = (...args) => console.warn(CONFIG.LOG_PREFIX, ...args);

  // --- Popup Detection ---

  /**
   * Find the event popup element in the DOM.
   * Tries multiple selector strategies, returns the first match.
   */
  function findEventPopup(root) {
    for (const selector of SELECTORS.EVENT_POPUP) {
      // Check if the root itself matches
      if (root.matches && root.matches(selector)) {
        return root;
      }
      // Check descendants
      const el = root.querySelector(selector);
      if (el) return el;
    }
    return null;
  }

  /**
   * Walk up from a matched element to find the actual popup container.
   * Google Calendar wraps event details in a bubble/popover whose root
   * we need for extracting all data.
   */
  function findPopupContainer(el) {
    const dialog = el.closest('[role="dialog"]');
    if (dialog) return dialog;
    return el;
  }

  // --- Date/Time Text Extraction ---

  /**
   * Extract the displayed date/time text from the popup via regex on textContent.
   * Returns the raw text as shown in Google Calendar, e.g.:
   *   JP: "2月 23日 (月曜日) · 17:00～17:15"
   *   EN: "Tuesday, February 24 · 1:30 – 2:00pm"
   */
  function extractDate(popup) {
    const text = popup.textContent || '';

    // --- Japanese patterns ---
    // "X月 Y日 (曜日) · HH:MM～HH:MM"
    const jpDateTime = text.match(
      /\d{1,2}月\s*\d{1,2}日\s*\([月火水木金土日]曜日\)\s*[·⋅•]\s*\d{1,2}:\d{2}\s*[～〜–\-]\s*\d{1,2}:\d{2}/
    );
    if (jpDateTime) return jpDateTime[0];

    // All-day: "X月 Y日 (曜日)"
    const jpDate = text.match(
      /\d{1,2}月\s*\d{1,2}日\s*\([月火水木金土日]曜日\)/
    );
    if (jpDate) return jpDate[0];

    // --- English patterns ---
    const enDays = '(?:Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday)';
    const enMonths = '(?:January|February|March|April|May|June|July|August|September|October|November|December)';

    // "Dayname, Monthname DD · H:MM – H:MMpm"
    const enDateTime = text.match(new RegExp(
      enDays + ',?\\s+' + enMonths + '\\s+\\d{1,2}\\s*[·⋅•]\\s*' +
      '\\d{1,2}:\\d{2}\\s*(?:AM|PM|am|pm)?\\s*[–\\-~]\\s*\\d{1,2}:\\d{2}\\s*(?:AM|PM|am|pm)?',
      'i'
    ));
    if (enDateTime) return enDateTime[0];

    // All-day: "Dayname, Monthname DD"
    const enDate = text.match(new RegExp(
      enDays + ',?\\s+' + enMonths + '\\s+\\d{1,2}',
      'i'
    ));
    if (enDate) return enDate[0];

    // --- Fallback: <time> element or [data-datekey] ---
    const timeEl = popup.querySelector('time[datetime]');
    if (timeEl) {
      const timeText = timeEl.textContent.trim();
      if (timeText) return timeText;
    }

    const dateKeyEl = popup.querySelector('[data-datekey]');
    if (dateKeyEl) {
      const dkText = dateKeyEl.textContent.trim();
      if (dkText) return dkText;
    }

    warn('Could not extract date/time text from popup');
    return null;
  }

  // --- Meeting URL Extraction ---

  /**
   * Extract a meeting URL from the popup by scanning all <a> links.
   */
  function extractMeetingUrl(popup) {
    const links = popup.querySelectorAll(SELECTORS.EVENT_LINKS);
    for (const link of links) {
      const href = link.href || link.getAttribute('href') || '';
      for (const pattern of MEETING_URL_PATTERNS) {
        const match = href.match(pattern);
        if (match) return match[0];
      }
    }

    // Fallback: scan text content for URLs
    const text = popup.textContent || '';
    for (const pattern of MEETING_URL_PATTERNS) {
      const match = text.match(pattern);
      if (match) return match[0];
    }

    return null;
  }

  // --- Button Injection ---

  /**
   * Find the best injection point for the copy button.
   */
  function findInjectionPoint(popup) {
    // Primary: near the Meet join button or action area
    for (const selector of SELECTORS.BUTTON_INJECTION_POINT) {
      const el = popup.querySelector(selector);
      if (el) return { element: el, position: 'after' };
    }

    // Fallback: title/heading area
    for (const selector of SELECTORS.BUTTON_INJECTION_FALLBACK) {
      const el = popup.querySelector(selector);
      if (el) return { element: el, position: 'after' };
    }

    // Last resort: first child of popup
    if (popup.firstElementChild) {
      return { element: popup.firstElementChild, position: 'after' };
    }

    return null;
  }

  /**
   * Create and inject the copy button into the popup.
   */
  function injectButton(popup) {
    // Guard: don't inject twice
    if (popup.querySelector(`.${CONFIG.BUTTON_CLASS}`)) return;

    const injectionPoint = findInjectionPoint(popup);
    if (!injectionPoint) {
      warn('No injection point found, cannot add button');
      return;
    }

    const btn = document.createElement('button');
    btn.className = CONFIG.BUTTON_CLASS;
    btn.textContent = 'コピー';
    btn.title = '日付とミーティングURLをコピー';
    btn.setAttribute('aria-label', '日付とミーティングURLをコピー');
    btn.type = 'button';

    btn.addEventListener('click', function (e) {
      e.preventDefault();
      e.stopPropagation();

      const dateStr = extractDate(popup);
      const meetingUrl = extractMeetingUrl(popup);
      handleCopy(dateStr, meetingUrl);
    });

    const target = injectionPoint.element;
    if (injectionPoint.position === 'after') {
      target.parentNode.insertBefore(btn, target.nextSibling);
    } else {
      target.parentNode.insertBefore(btn, target);
    }

  }

  // --- Clipboard + Toast ---

  /**
   * Build the copy text and write to clipboard.
   */
  async function handleCopy(dateStr, meetingUrl) {
    let copyText = '';

    if (dateStr && meetingUrl) {
      copyText = `${dateStr}\n${meetingUrl}`;
    } else if (dateStr && !meetingUrl) {
      copyText = `${dateStr}\nURLなし`;
    } else if (!dateStr && meetingUrl) {
      copyText = meetingUrl;
    } else {
      showToast('データを取得できませんでした', true);
      warn('Neither date nor URL could be extracted');
      return;
    }

    try {
      await navigator.clipboard.writeText(copyText);
      showToast('コピーしました');
    } catch (err) {
      warn('Clipboard write failed:', err);
      showToast('コピーに失敗しました', true);
    }
  }

  /**
   * Show a toast notification at the bottom of the screen.
   */
  function showToast(message, isError) {
    // Remove any existing toast
    const existing = document.querySelector(`.${CONFIG.TOAST_CLASS}`);
    if (existing) {
      existing.remove();
    }

    const toast = document.createElement('div');
    toast.className = CONFIG.TOAST_CLASS;
    if (isError) {
      toast.classList.add('gcal-url-retriever-toast--error');
    }
    toast.textContent = message;
    toast.setAttribute('role', 'status');
    toast.setAttribute('aria-live', 'polite');

    document.body.appendChild(toast);

    // Trigger slide-up animation on next frame
    requestAnimationFrame(() => {
      toast.classList.add('gcal-url-retriever-toast--visible');
    });

    // Auto-dismiss
    setTimeout(() => {
      toast.classList.remove('gcal-url-retriever-toast--visible');
      toast.addEventListener('transitionend', () => toast.remove(), { once: true });
      // Fallback removal if transitionend doesn't fire
      setTimeout(() => {
        if (toast.parentNode) toast.remove();
      }, 500);
    }, CONFIG.TOAST_DURATION_MS);
  }

  // --- MutationObserver ---

  /**
   * Process a node added to the DOM — check if it's an event popup.
   */
  function processAddedNode(node) {
    if (node.nodeType !== Node.ELEMENT_NODE) return;

    const popup = findEventPopup(node);
    if (!popup) return;

    const container = findPopupContainer(popup);

    // Guard: don't inject if button already present
    if (container.querySelector(`.${CONFIG.BUTTON_CLASS}`)) return;

    waitForStableContent(container);
  }

  /**
   * Wait for popup content to stabilize before injecting the button.
   * Google Calendar re-renders/hydrates popup content in phases, so injecting
   * immediately can result in the button being destroyed by a later render.
   *
   * Uses a secondary MutationObserver on the popup itself. Resets a debounce
   * timer on each child mutation. After POPUP_STABILIZE_DELAY_MS of no
   * mutations, injects the button. Safety valve: after
   * POPUP_STABILIZE_MAX_RETRIES mutation batches, forces injection.
   */
  function waitForStableContent(popup) {
    let timer = null;
    let mutationCount = 0;
    const delay = CONFIG.POPUP_STABILIZE_DELAY_MS;
    const maxRetries = CONFIG.POPUP_STABILIZE_MAX_RETRIES;

    function doInject() {
      stabilizeObserver.disconnect();
      if (popup.querySelector(`.${CONFIG.BUTTON_CLASS}`)) return;
      injectButton(popup);
      observeForReinjection(popup);
    }

    const stabilizeObserver = new MutationObserver(() => {
      mutationCount++;
      clearTimeout(timer);

      if (mutationCount >= maxRetries) {
        timer = setTimeout(doInject, delay);
        return;
      }

      timer = setTimeout(doInject, delay);
    });

    stabilizeObserver.observe(popup, { childList: true, subtree: true });

    // Kickstart: if no mutations arrive (content already stable), inject after delay
    timer = setTimeout(doInject, delay);
  }

  /**
   * After successful injection, watch for late re-renders that remove the
   * button and re-inject if needed. Disconnects when popup is removed from DOM.
   */
  function observeForReinjection(popup) {
    const reinjectionObserver = new MutationObserver(() => {
      // Popup removed from DOM — stop watching
      if (!document.contains(popup)) {
        reinjectionObserver.disconnect();
        return;
      }

      // Button was removed by a re-render — re-inject
      if (!popup.querySelector(`.${CONFIG.BUTTON_CLASS}`)) {
        injectButton(popup);
      }
    });

    reinjectionObserver.observe(popup, { childList: true, subtree: true });
  }

  const observer = new MutationObserver((mutations) => {
    for (const mutation of mutations) {
      for (const node of mutation.addedNodes) {
        processAddedNode(node);
      }
    }
  });

  observer.observe(document.body, {
    childList: true,
    subtree: true,
  });

})();
