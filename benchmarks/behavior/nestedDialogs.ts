import type { Page } from 'playwright';
import { centerOf, pressAt } from './input.ts';
import {
  belowIsInert,
  countAfterInput,
  escapeClosesTop,
  focusMovesIn,
  focusReturns,
  inputDuringExit,
  isShown,
  openBoth,
  openFirst,
  openSecond,
  read,
  readAfterInput,
  shownLayers,
  tabStaysIn,
  waitUntilGone,
} from './layers.ts';
import type { Recording } from './recorder.ts';
import { FULL_OPACITY, isValid, largestFrameGap } from './samples.ts';
import type { CaseResult, Group } from './types.ts';

const PREFIX = 'dialog';
const SCENARIO = 'NestedDialogs';
/** A point outside the two dialogs. */
const OUTSIDE = { x: 8, y: 8 };

const APG_DIALOG = {
  text: 'WAI-ARIA APG, Dialog (Modal) Pattern',
  url: 'https://www.w3.org/WAI/ARIA/apg/patterns/dialog-modal/',
};
const HTML_CLOSE_THE_DIALOG = {
  text: 'HTML, close the dialog',
  url: 'https://html.spec.whatwg.org/multipage/interactive-elements.html#close-the-dialog',
};

/** The element with the dialog role that holds a marker: the marker itself or an ancestor. */
function dialogOf(page: Page, marker: string) {
  return page
    .locator(`[data-bench="${marker}"]`)
    .filter({ visible: true })
    .locator(
      'xpath=ancestor-or-self::*[@role="dialog" or @role="alertdialog" or local-name()="dialog"][1]',
    );
}

/** The role and the name of a dialog, by the rules of Playwright, such as `dialog "Dialog 1"`. */
async function roleAndName(page: Page, marker: string): Promise<string> {
  const dialog = dialogOf(page, marker);
  if ((await dialog.count()) === 0) {
    return 'no dialog role';
  }
  const [line = ''] = (await dialog.ariaSnapshot()).split('\n');
  return line.replace(/^- /, '').replace(/:$/, '') || 'not in the accessibility tree';
}

/** The text of the elements that `aria-describedby` of a dialog names, else `aria-description`. */
async function description(page: Page, marker: string): Promise<string> {
  const dialog = dialogOf(page, marker);
  if ((await dialog.count()) === 0) {
    return 'no dialog role';
  }
  return dialog.evaluate((element) => {
    const ids = element.getAttribute('aria-describedby')?.split(/\s+/).filter(Boolean) ?? [];
    const text = ids
      .map((id) => element.ownerDocument.getElementById(id)?.textContent ?? '')
      .join(' ')
      .replace(/\s+/g, ' ')
      .trim();
    return text || element.getAttribute('aria-description') || 'none';
  });
}

async function nameAndDescription(page: Page, caseName: string | null): Promise<CaseResult> {
  const readValue = caseName === 'description' ? description : roleAndName;
  const expected = (layer: string) =>
    caseName === 'description' ? `Description ${layer}` : `dialog "Dialog ${layer}"`;
  // A dialog below can leave the accessibility tree, so each dialog is read while it is on top.
  await openFirst(page, PREFIX);
  const first = await readValue(page, `${PREFIX}-1`);
  await openSecond(page, PREFIX);
  const second = await readValue(page, `${PREFIX}-2`);
  const measure = `Dialog 1: ${first}. Dialog 2: ${second}.`;
  return first === expected('1') && second === expected('2')
    ? { verdict: 'pass', measure }
    : { verdict: 'fail', measure, reason: measure };
}

async function outsidePressClosesTop(page: Page): Promise<CaseResult> {
  await openBoth(page, PREFIX);
  await pressAt(page, OUTSIDE);
  await waitUntilGone(page, `${PREFIX}-2`);
  const frame = await read(page, [`${PREFIX}-1`, `${PREFIX}-2`]);
  const measure = `Open: ${shownLayers(frame, PREFIX)}.`;
  return isShown(frame, `${PREFIX}-1`)
    ? { verdict: 'pass', measure }
    : { verdict: 'fail', measure, reason: 'The press closes the dialog below.' };
}

async function belowStaysModal(page: Page): Promise<CaseResult> {
  const first = `${PREFIX}-1`;
  await openBoth(page, PREFIX);
  await page.keyboard.press('Escape');
  await waitUntilGone(page, `${PREFIX}-2`);
  for (let press = 1; press <= 6; press++) {
    await page.keyboard.press('Tab');
    const frame = await readAfterInput(page, [first]);
    if (frame.focusInLayer[first] !== true) {
      const measure = `Tab ${String(press)}: ${frame.active}.`;
      return {
        verdict: 'fail',
        measure,
        reason: `Tab ${String(press)} moves the focus to ${frame.active}.`,
      };
    }
  }
  await pressAt(page, await centerOf(page, 'page-action'));
  const count = await countAfterInput(page, 'page-count');
  const measure = `6 Tab presses stay in dialog 1. Page count ${count}.`;
  return count === '0'
    ? { verdict: 'pass', measure }
    : { verdict: 'fail', measure, reason: 'The press on the page uses its button.' };
}

/** The first frame in which dialog 1 is not the same element at full opacity, as a reason. */
function firstChange(recording: Recording): string | undefined {
  const marker = `${PREFIX}-1`;
  const id = recording.frames[0]?.elements[marker]?.find((element) => element.visible)?.id;
  for (const [index, frame] of recording.frames.entries()) {
    const element = frame.elements[marker]?.find((item) => item.id === id);
    const time = `${String(Math.round(frame.time - (recording.frames[0]?.time ?? 0)))} ms`;
    if (element === undefined) {
      return `In frame ${String(index + 1)} (${time}), dialog 1 is another element.`;
    }
    if (!element.visible) {
      return `In frame ${String(index + 1)} (${time}), dialog 1 does not show.`;
    }
    if (element.opacity < FULL_OPACITY) {
      return `In frame ${String(index + 1)} (${time}), dialog 1 has an opacity of ${element.opacity.toFixed(2)}.`;
    }
  }
  return undefined;
}

async function belowStaysRendered(page: Page): Promise<CaseResult> {
  await openFirst(page, PREFIX);
  await page.evaluate((marker) => {
    window.behaviorRecorder.start([marker]);
  }, `${PREFIX}-1`);
  await openSecond(page, PREFIX);
  await page.keyboard.press('Escape');
  await waitUntilGone(page, `${PREFIX}-2`);
  const recording = await page.evaluate(() => window.behaviorRecorder.stop());
  if (!isValid(recording)) {
    return {
      verdict: 'not-valid',
      measure: `A gap of ${String(Math.round(largestFrameGap(recording.frames)))} ms between two frames.`,
    };
  }
  const change = firstChange(recording);
  const frames = `${String(recording.frames.length)} frames`;
  return change === undefined
    ? { verdict: 'pass', measure: `Dialog 1 is the same element at full opacity in ${frames}.` }
    : { verdict: 'fail', measure: `${change} ${frames} in all.`, reason: change };
}

/**
 * The fixture `NestedDialogs`: `page-action` counts its presses in `page-count`, and
 * `dialog-1-trigger` opens `dialog-1`. Dialog 1 holds `dialog-1-action`, which counts its presses
 * in `dialog-1-count`, and `dialog-2-trigger`, which opens `dialog-2`. Dialog 2 holds
 * `dialog-2-action`. Each dialog has a title, a description and a Close button.
 */
export const NESTED_DIALOGS: Group = {
  id: 'nested-dialogs',
  title: 'Nested dialogs',
  notes: {
    'headless-ui': 'The docs give no nested pattern.',
    vuetify0: 'The docs give no nested pattern, and no animation of a dialog.',
  },
  checks: [
    {
      id: 'focus-moves-in',
      title: 'The focus moves into the dialog on top.',
      expectation: APG_DIALOG,
      scenario: SCENARIO,
      run: (page) => focusMovesIn(page, PREFIX),
    },
    {
      id: 'tab-stays-in',
      title: 'Tab and Shift+Tab stay in the dialog on top.',
      expectation: APG_DIALOG,
      scenario: SCENARIO,
      run: (page) => tabStaysIn(page, PREFIX),
    },
    {
      id: 'below-is-inert',
      title: 'A press on a button of the dialog below does not use that button.',
      expectation: {
        text: 'HTML, show a modal dialog',
        url: 'https://html.spec.whatwg.org/multipage/interactive-elements.html#show-a-modal-dialog',
      },
      scenario: SCENARIO,
      run: (page) => belowIsInert(page, PREFIX),
    },
    {
      id: 'escape-closes-top',
      title: 'Escape closes only the dialog on top.',
      expectation: {
        text: 'HTML, close requests',
        url: 'https://html.spec.whatwg.org/multipage/interaction.html#close-requests',
      },
      scenario: SCENARIO,
      run: (page) => escapeClosesTop(page, PREFIX),
    },
    {
      id: 'outside-press-closes-top',
      title: 'A press outside the two dialogs closes no dialog but the one on top.',
      expectation: {
        text: 'HTML, light dismiss',
        url: 'https://html.spec.whatwg.org/multipage/interactive-elements.html#light-dismiss-open-dialogs',
      },
      scenario: SCENARIO,
      run: outsidePressClosesTop,
    },
    {
      id: 'focus-returns',
      title: 'The focus returns to the button that opened the dialog.',
      expectation: APG_DIALOG,
      scenario: SCENARIO,
      cases: [`${PREFIX} 2`, `${PREFIX} 1`],
      run: (page, caseName) => focusReturns(page, PREFIX, caseName),
    },
    {
      id: 'below-stays-modal',
      title:
        'After the dialog on top closes, the first dialog keeps the focus and the page stays inert.',
      expectation: HTML_CLOSE_THE_DIALOG,
      scenario: SCENARIO,
      run: belowStaysModal,
    },
    {
      id: 'name-and-description',
      title: 'Each dialog has the role dialog, its title as its name and its description.',
      expectation: {
        text: 'WAI-ARIA APG, Dialog (Modal) Pattern, roles and properties',
        url: 'https://www.w3.org/WAI/ARIA/apg/patterns/dialog-modal/#wai-ariaroles,states,andproperties',
      },
      scenario: SCENARIO,
      cases: ['name', 'description'],
      run: nameAndDescription,
    },
    {
      id: 'below-stays-rendered',
      title: 'The dialog below stays on the screen while the dialog on top opens and closes.',
      expectation: {
        text: 'CSS Positioned Layout 4, top layer',
        url: 'https://drafts.csswg.org/css-position-4/#top-layer',
      },
      scenario: SCENARIO,
      run: belowStaysRendered,
    },
    {
      id: 'input-during-exit',
      title: 'The dialog below takes the input while the dialog on top leaves.',
      expectation: HTML_CLOSE_THE_DIALOG,
      scenario: SCENARIO,
      cases: ['focus', 'escape', 'press'],
      run: (page, caseName) => inputDuringExit(page, PREFIX, caseName),
    },
  ],
};
