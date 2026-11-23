import type { Group } from './types.ts';

const POPUPS = ['Dialog', 'Popover', 'Menu', 'Select', 'Tooltip'];
const ANCHORED_POPUPS = ['Popover', 'Menu', 'Select', 'Tooltip'];
const FIXTURES = Object.fromEntries(POPUPS.map((popup) => [popup, `Animated${popup}`]));
const STARTING = {
  text: 'CSS Transitions, starting of transitions',
  url: 'https://www.w3.org/TR/css-transitions-1/#starting',
};
const REVERSING = {
  text: 'CSS Transitions, reversing of interrupted transitions',
  url: 'https://www.w3.org/TR/css-transitions-1/#reversing',
};
const ANCHOR_ORIGIN = {
  text: 'Android, DropdownMenuPopupPositionProvider',
  url: 'https://developer.android.com/reference/kotlin/androidx/compose/material3/DropdownMenuPopupPositionProvider',
};

export const POPUP_ANIMATIONS: Group = {
  id: 'popup-animations',
  title: 'Popup animations',
  checks: [
    {
      id: 'enter-from-first-frame',
      title: 'The enter starts in the first frame and ends after one duration.',
      expectation: STARTING,
      scenario: FIXTURES,
      cases: POPUPS,
    },
    {
      id: 'exit-before-removal',
      title: 'The exit runs to its end before the popup leaves the screen.',
      expectation: STARTING,
      scenario: FIXTURES,
      cases: POPUPS,
    },
    {
      id: 'close-during-enter-no-jump',
      title: 'A close during the enter shows no jump.',
      expectation: REVERSING,
      scenario: FIXTURES,
      cases: POPUPS,
    },
    {
      id: 'close-during-enter-goes-back',
      title: 'A close during the enter goes back from where the popup is.',
      expectation: REVERSING,
      scenario: FIXTURES,
      cases: POPUPS,
    },
    {
      id: 'reopen-during-exit-no-jump',
      title: 'An open during the exit shows no jump.',
      expectation: REVERSING,
      scenario: FIXTURES,
      cases: POPUPS,
    },
    {
      id: 'reopen-during-exit-goes-back',
      title: 'An open during the exit goes back from where the popup is.',
      expectation: REVERSING,
      scenario: FIXTURES,
      cases: POPUPS,
    },
    {
      id: 'origin-at-anchor',
      title: 'The popup grows from its anchor.',
      expectation: ANCHOR_ORIGIN,
      scenario: FIXTURES,
      cases: ANCHORED_POPUPS,
    },
    {
      id: 'origin-after-flip',
      title: 'After a flip to the other side, the popup grows from its anchor.',
      expectation: ANCHOR_ORIGIN,
      scenario: FIXTURES,
      cases: ANCHORED_POPUPS,
    },
  ],
};
