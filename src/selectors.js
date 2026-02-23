/**
 * DOM Selectors and Configuration
 *
 * Google Calendar uses obfuscated/minified CSS class names that change frequently.
 * All selectors here rely on ARIA attributes, data attributes, semantic HTML,
 * and structural patterns — NOT class names.
 *
 * When Google changes its DOM structure, update selectors here only.
 */
const SELECTORS = {
  // Event popup detection — only match actual detail popup dialogs
  EVENT_POPUP: [
    '[role="dialog"]',
  ],

  // Date extraction — ordered by reliability
  EVENT_DATE: [
    'time[datetime]',
    '[data-datekey]',
    '[role="heading"]',
  ],

  // Links inside event popup
  EVENT_LINKS: 'a[href]',

  // Button injection — near Meet join button or action area
  BUTTON_INJECTION_POINT: [
    '[data-meet-link]',
    'a[href*="meet.google.com"]',
    '[aria-label*="Google Meet"]',
    '[aria-label*="Join with Google Meet"]',
    '[aria-label*="Google Meet に参加"]',
    '[data-action-type]',
  ],

  // Fallback — title/heading area of popup (scoped within dialog)
  BUTTON_INJECTION_FALLBACK: [
    '[role="heading"]',
    '[data-eventid]',
    'span[role="button"]',
  ],
};

// Meeting URL patterns — regex array for various providers
const MEETING_URL_PATTERNS = [
  /https?:\/\/meet\.google\.com\/[a-z\-]+/i,
  /https?:\/\/[\w.-]*zoom\.us\/j\/\d+/i,
  /https?:\/\/teams\.microsoft\.com\/l\/meetup-join\/[^\s"<>]+/i,
  /https?:\/\/[\w.-]*webex\.com\/[\w./\-?=&]+/i,
  /https?:\/\/[\w.-]*chime\.aws\/\d+/i,
];

const CONFIG = {
  // When false: show button even if no meeting URL (copies date + "URLなし")
  HIDE_BUTTON_WHEN_NO_URL: false,
  LOG_PREFIX: '[GCal URL Retriever]',
  TOAST_DURATION_MS: 3000,
  BUTTON_CLASS: 'gcal-url-retriever-btn',
  TOAST_CLASS: 'gcal-url-retriever-toast',
  // Stabilization: wait for popup content to settle before injecting
  POPUP_STABILIZE_DELAY_MS: 300,
  POPUP_STABILIZE_MAX_RETRIES: 5,
};
