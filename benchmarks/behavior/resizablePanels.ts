import type { Group } from './types.ts';

const APG_SPLITTER = {
  text: 'WAI-ARIA APG, Window Splitter Pattern',
  url: 'https://www.w3.org/WAI/ARIA/apg/patterns/windowsplitter/',
};
const POINTER_CAPTURE = {
  text: 'Pointer Events, pointer capture',
  url: 'https://www.w3.org/TR/pointerevents3/#pointer-capture',
};

export const RESIZABLE_PANELS: Group = {
  id: 'resizable-panels',
  title: 'Resizable panels',
  notes: { 'ark-ui': 'Preview in its docs.' },
  checks: [
    {
      id: 'separator-role',
      title:
        'The handle has the role separator with its value, its limits and the panel that it controls.',
      expectation: APG_SPLITTER,
      scenario: 'ResizablePanels',
      cases: ['role and value', 'limits', 'controls'],
    },
    {
      id: 'arrow-keys',
      title: 'The arrow keys move the handle.',
      expectation: APG_SPLITTER,
      scenario: 'ResizablePanels',
    },
    {
      id: 'home-and-end',
      title:
        'Home and End move the handle to the smallest and the largest size. The APG calls these keys optional.',
      expectation: APG_SPLITTER,
      scenario: 'ResizablePanels',
    },
    {
      id: 'enter-collapses',
      title: 'Enter collapses the panel, and Enter again gives its size back.',
      expectation: APG_SPLITTER,
      scenario: 'ResizablePanels',
    },
    {
      id: 'follows-pointer',
      title: 'The handle follows the pointer in a drag.',
      expectation: POINTER_CAPTURE,
      scenario: 'ResizablePanels',
    },
    {
      id: 'drag-over-iframe',
      title: 'The drag goes on while the pointer is over an iframe.',
      expectation: POINTER_CAPTURE,
      scenario: 'ResizablePanels',
    },
    {
      id: 'returns-under-pointer',
      title: 'After a drag past the limit and back, the handle is under the pointer again.',
      expectation: POINTER_CAPTURE,
      scenario: 'ResizablePanels',
    },
  ],
};
