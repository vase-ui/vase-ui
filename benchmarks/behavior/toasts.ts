import type { Group } from './types.ts';

const TIMING_ADJUSTABLE = {
  text: 'WCAG 2.2, Success Criterion 2.2.1 Timing Adjustable',
  url: 'https://www.w3.org/WAI/WCAG22/Understanding/timing-adjustable.html',
};

export const TOASTS: Group = {
  id: 'toasts',
  title: 'Toasts',
  checks: [
    {
      id: 'keeps-focus',
      title: 'A new toast does not take the focus.',
      expectation: {
        text: 'WAI-ARIA APG, Alert Pattern',
        url: 'https://www.w3.org/WAI/ARIA/apg/patterns/alert/',
      },
      scenario: 'Toasts',
    },
    {
      id: 'live-region',
      title: 'A toast is in a live region.',
      expectation: {
        text: 'WCAG 2.2, Success Criterion 4.1.3 Status Messages',
        url: 'https://www.w3.org/WAI/WCAG22/Understanding/status-messages.html',
      },
      scenario: 'Toasts',
    },
    {
      id: 'important-is-assertive',
      title: 'An important toast is announced at once.',
      expectation: {
        text: 'WAI-ARIA 1.2, alert role',
        url: 'https://www.w3.org/TR/wai-aria-1.2/#alert',
      },
      scenario: 'Toasts',
    },
    {
      id: 'timer-stops-at-hover',
      title: 'The timer stops while the pointer is on a toast.',
      expectation: TIMING_ADJUSTABLE,
      scenario: 'Toasts',
    },
    {
      id: 'timer-stops-at-focus',
      title: 'The timer stops while the focus is in a toast.',
      expectation: TIMING_ADJUSTABLE,
      scenario: 'Toasts',
    },
    {
      id: 'keyboard-reaches-action',
      title: 'The keyboard reaches the action of a toast.',
      expectation: {
        text: 'WCAG 2.2, Success Criterion 2.1.1 Keyboard',
        url: 'https://www.w3.org/WAI/WCAG22/Understanding/keyboard.html',
      },
      scenario: 'Toasts',
    },
    {
      id: 'focus-returns',
      title: 'After the keyboard closes a toast, the focus goes back to where it was.',
      expectation: {
        text: 'WCAG 2.2, Success Criterion 2.4.3 Focus Order',
        url: 'https://www.w3.org/WAI/WCAG22/Understanding/focus-order.html',
      },
      scenario: 'Toasts',
    },
    {
      id: 'swipe-closes',
      title: 'A swipe closes a toast.',
      expectation: {
        text: 'Android, SwipeDismissBehavior',
        url: 'https://developer.android.com/reference/com/google/android/material/behavior/SwipeDismissBehavior',
      },
      scenario: 'Toasts',
      cases: ['mouse', 'touch'],
    },
    {
      id: 'stack-moves',
      title: 'When a toast closes, the toasts that stay move over more than one frame.',
      expectation: {
        text: 'Apple Human Interface Guidelines, Motion',
        url: 'https://developer.apple.com/design/human-interface-guidelines/motion',
      },
      scenario: 'Toasts',
    },
  ],
};
