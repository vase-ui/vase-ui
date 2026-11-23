import type { Group } from './types.ts';

const UIKIT_SHEET = {
  text: 'UIKit, UISheetPresentationController',
  url: 'https://developer.apple.com/documentation/uikit/uisheetpresentationcontroller',
};
const ANDROID_BOTTOM_SHEET = {
  text: 'Android, BottomSheetBehavior',
  url: 'https://developer.android.com/reference/com/google/android/material/bottomsheet/BottomSheetBehavior',
};
const POINTERS = ['mouse', 'touch'];

export const DRAWERS: Group = {
  id: 'drawers',
  title: 'Drawers',
  notes: { 'reka-ui': 'Alpha in its docs.', 'ark-ui': 'Preview in its docs.' },
  checks: [
    {
      id: 'follows-pointer',
      title: 'The drawer follows the pointer in a drag.',
      expectation: UIKIT_SHEET,
      scenario: 'NestedDrawers',
      cases: POINTERS,
    },
    {
      id: 'returns-after-short-drag',
      title: 'A short, slow drag returns the drawer to its place.',
      expectation: ANDROID_BOTTOM_SHEET,
      scenario: 'NestedDrawers',
      cases: POINTERS,
    },
    {
      id: 'closes-after-long-drag',
      title: 'A drag past three quarters of the height closes the drawer.',
      expectation: ANDROID_BOTTOM_SHEET,
      scenario: 'NestedDrawers',
      cases: POINTERS,
    },
    {
      id: 'closes-after-flick',
      title: 'A fast flick closes the drawer.',
      expectation: ANDROID_BOTTOM_SHEET,
      scenario: 'NestedDrawers',
      cases: POINTERS,
    },
    {
      id: 'settles-with-no-jump',
      title: 'After the release, the drawer moves on from the place of the release.',
      expectation: ANDROID_BOTTOM_SHEET,
      scenario: 'NestedDrawers',
      cases: POINTERS,
    },
    {
      id: 'swipe-closes-top',
      title: 'A swipe on the drawer on top closes only that drawer.',
      expectation: UIKIT_SHEET,
      scenario: 'NestedDrawers',
      cases: POINTERS,
    },
    {
      id: 'escape-closes-top',
      title: 'Escape closes only the drawer on top.',
      expectation: {
        text: 'HTML, close requests',
        url: 'https://html.spec.whatwg.org/multipage/interaction.html#close-requests',
      },
      scenario: 'NestedDrawers',
    },
    {
      id: 'focus-returns',
      title: 'The focus returns to the button that opened the drawer.',
      expectation: {
        text: 'WAI-ARIA APG, Dialog (Modal) Pattern',
        url: 'https://www.w3.org/WAI/ARIA/apg/patterns/dialog-modal/',
      },
      scenario: 'NestedDrawers',
      cases: ['drawer 2', 'drawer 1'],
    },
    {
      id: 'below-is-inert',
      title: 'A press on a button of the drawer below does not use that button.',
      expectation: {
        text: 'HTML, show a modal dialog',
        url: 'https://html.spec.whatwg.org/multipage/interactive-elements.html#show-a-modal-dialog',
      },
      scenario: 'NestedDrawers',
    },
    {
      id: 'settles-at-snap-point',
      title: 'A release near a snap point puts the drawer on that point.',
      expectation: UIKIT_SHEET,
      scenario: 'DrawerSnapPoints',
      cases: POINTERS,
    },
    {
      id: 'input-during-exit',
      title: 'The drawer below takes the input while the drawer on top leaves.',
      expectation: {
        text: 'HTML, close the dialog',
        url: 'https://html.spec.whatwg.org/multipage/interactive-elements.html#close-the-dialog',
      },
      scenario: 'NestedDrawers',
      cases: ['focus', 'escape', 'press'],
    },
  ],
};
