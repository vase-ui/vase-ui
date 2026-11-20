import { describe, expect, inject, onTestFinished, test } from 'vitest';
import { userEvent } from 'vitest/browser';
import { defineComponent, h, nextTick, reactive } from 'vue';
import type { TimeClockRootChangeEventDetails } from '@vase-ui/vue/time-clock';
import { reset as resetWarnings } from '../common/warn';
import { dataAttributes } from '../../test/field';
import DateTimePartsInLocaleProvider from '../../test/fixtures/DateTimePartsInLocaleProvider.vue';
import TimeClockAs from '../../test/fixtures/TimeClockAs.vue';
import TimeClockParts from '../../test/fixtures/TimeClockParts.vue';
import TimeClockSlots from '../../test/fixtures/TimeClockSlots.vue';
import { mount, settle } from '../../test/render';
import { takeReportedMessages } from '../../test/reportedMessages';
import { pointOnFace } from '../../test/time-clockTestUtils';

const time = (text: string) => Temporal.PlainTime.from(text);

/** A component with a class of its own on its element. */
const ClassedSpan = defineComponent({
  setup(_, { slots }) {
    return () => h('span', { class: 'Own' }, slots.default?.());
  },
});

/** Props of a clock that write each event in `log`. */
function record(log: string[], attrs: Record<string, unknown> = {}) {
  return reactive<Record<string, unknown>>({
    onValueChange: (value: unknown, details: TimeClockRootChangeEventDetails) =>
      log.push(`valueChange ${String(value)} ${details.reason}`),
    onValueCommitted: (value: unknown, details: { reason: string }) =>
      log.push(`valueCommitted ${String(value)} ${details.reason}`),
    onViewChange: (view: string, details: { reason: string }) =>
      log.push(`viewChange ${view} ${details.reason}`),
    ...attrs,
  });
}

async function mountClock(props: Record<string, unknown> = {}) {
  const { root, exposed } = mount(TimeClockParts, props);
  await nextTick();
  const byTestId = (id: string) => root.querySelector<HTMLElement>(`[data-testid="${id}"]`);
  return {
    root,
    exposed,
    group: root.querySelector<HTMLElement>('[role="group"]')!,
    face: () => byTestId('face')!,
    range: () => root.querySelector<HTMLInputElement>('input[type="range"]')!,
    hand: () => byTestId('hand'),
    byTestId,
    numbers: () => [...root.querySelectorAll<HTMLElement>('[data-testid="face"] span')],
  };
}

const at = (face: HTMLElement, angle: number, ratio?: number) => {
  const { clientX: x, clientY: y } = pointOnFace(face, angle, ratio);
  return { x, y };
};

let isHeld = false;

async function release(point: { x: number; y: number }) {
  isHeld = false;
  await userEvent.pointer({ coords: point, keys: '[/MouseLeft]' });
}

/** Presses the main button on the face and holds it. The case gets the release when it ends. */
async function pressAt(face: HTMLElement, angle: number, ratio?: number) {
  const point = at(face, angle, ratio);
  isHeld = true;
  onTestFinished(async () => {
    if (isHeld) await release(point);
  });
  await userEvent.pointer({ coords: point, keys: '[MouseLeft>]' });
}

async function releaseAt(face: HTMLElement, angle: number, ratio?: number) {
  await release(at(face, angle, ratio));
}

describe('the parts', () => {
  test('the root is a group with the state of the clock; the face holds its numbers, the hand and a range input', async () => {
    const { group, face, range, numbers, hand } = await mountClock({
      clock: { defaultValue: time('15:30') },
    });
    expect(dataAttributes(group)).toEqual(['data-allow-mismatch', 'data-view']);
    expect(group).toHaveAttribute('data-view', 'hour');
    expect(face().lastElementChild).toBe(range());
    expect(face().style.touchAction).toBe('none');
    expect(numbers()).toHaveLength(12);
    expect(numbers()[0]).toHaveTextContent('12');
    expect(numbers()[0]).toHaveAttribute('aria-hidden', 'true');
    expect(numbers()[3]).toHaveAttribute('data-selected');
    expect(numbers()[3]!.style.getPropertyValue('--time-clock-number-angle')).toBe('90deg');
    expect(hand()).toHaveAttribute('aria-hidden', 'true');
    expect(hand()!.style.getPropertyValue('--time-clock-hand-angle')).toBe('90deg');
    expect(range()).toHaveAttribute('aria-label', 'hour');
    expect(range()).toHaveAttribute('aria-valuetext', '3 hours');
    expect(range()).not.toHaveAttribute('aria-valuenow');
    expect([range().min, range().max, range().step, range().value]).toEqual(['1', '12', '1', '3']);
    expect(range().name).toBe('');
  });

  test('with no value, the face shows the time of `referenceDate`, no number is selected, and there is no hand', async () => {
    const { range, numbers, hand, byTestId } = await mountClock({
      clock: { referenceDate: time('09:00') },
    });
    expect(range().value).toBe('9');
    expect(numbers().some((number) => number.hasAttribute('data-selected'))).toBe(false);
    expect(hand()).toBe(null);
    expect(byTestId('hour-trigger')).toHaveTextContent('--');
    expect(byTestId('hour-trigger')).toHaveAttribute('aria-label', 'hour');
  });

  test('the hand of a minute between two numbers has `data-between-numbers`', async () => {
    const { hand } = await mountClock({
      clock: { defaultValue: time('15:07'), defaultView: 'minute' },
    });
    expect(hand()).toHaveAttribute('data-between-numbers');
    expect(hand()!.style.getPropertyValue('--time-clock-hand-angle')).toBe('42deg');
  });

  test('a step that is not a whole number above 0 gives a warning', async () => {
    resetWarnings();
    await mountClock({ clock: { minuteStep: 0 } });
    expect(takeReportedMessages()).toEqual([
      'console.warn: Vase UI: TimeClock `minuteStep` must be a whole number above 0. The clock uses a step of 1 instead. Set `minuteStep` to a whole number above 0.',
    ]);
  });

  test('the locale is that of the nearest `LocaleProvider` with no prop, with its hour cycle', async () => {
    const { root } = mount(DateTimePartsInLocaleProvider, { locale: 'de-DE' });
    await nextTick();
    const range = root.querySelector<HTMLInputElement>('input[type="range"]')!;
    expect(range).toHaveAttribute('aria-label', 'Stunde');
    expect([range.min, range.max, range.value]).toEqual(['0', '23', '15']);
  });

  test('a 24-hour face has an inner ring and no day period', async () => {
    const { numbers, byTestId } = await mountClock({ clock: { hourCycle: 24 } });
    expect(numbers()).toHaveLength(24);
    expect(numbers().filter((number) => number.hasAttribute('data-inner'))).toHaveLength(12);
    expect(byTestId('am')).toBe(null);
  });

  test('`aria-valuetext`: the attribute of the developer, else `getAriaValueText`, also with no value', async () => {
    const face = reactive<Record<string, unknown>>({
      getAriaValueText: (value: number, view: string) => `${view} ${value}`,
    });
    const { range } = await mountClock({ face });
    expect(range()).toHaveAttribute('aria-valuetext', 'hour 12');
    Object.assign(face, { 'aria-valuetext': 'noon', 'aria-label': 'Hour', id: 'clock-hour' });
    await nextTick();
    expect(range()).toHaveAttribute('aria-valuetext', 'noon');
    expect(range()).toHaveAttribute('aria-label', 'Hour');
    expect(range().id).toBe('clock-hour');
  });

  test('the triggers and the day periods are buttons with `aria-pressed`', async () => {
    const { byTestId } = await mountClock({ clock: { defaultValue: time('15:30') } });
    const pm = byTestId('pm') as HTMLButtonElement;
    expect(pm.type).toBe('button');
    expect(pm).toHaveTextContent('PM');
    expect(pm).toHaveAttribute('aria-pressed', 'true');
    expect(byTestId('am')).toHaveAttribute('aria-pressed', 'false');
    expect(byTestId('hour-trigger')).toHaveTextContent('03');
    expect(byTestId('hour-trigger')).toHaveAttribute('aria-label', 'hour 03');
    expect(byTestId('hour-trigger')).toHaveAttribute('aria-pressed', 'true');
  });

  test('`as` renders a tag in place of the element of each part', async () => {
    const { root } = mount(TimeClockAs);
    await nextTick();
    const group = root.querySelector('section')!;
    expect(group).toHaveAttribute('role', 'group');
    const [trigger, pm] = group.querySelectorAll('span');
    expect(trigger).toHaveAttribute('role', 'button');
    expect(trigger).toHaveTextContent('03');
    expect(trigger).toHaveAttribute('aria-label', 'hour 03');
    expect(pm).toHaveAttribute('role', 'button');
    expect(pm).toHaveTextContent('PM');
    expect(pm).toHaveAttribute('aria-pressed', 'true');
    const face = group.querySelector('article')!;
    expect(face.lastElementChild).toBe(face.querySelector('input[type="range"]'));
    const hand = face.querySelector('i')!;
    expect(hand.style.getPropertyValue('--time-clock-hand-angle')).toBe('90deg');
    const numbers = [...face.querySelectorAll('b')];
    expect(numbers.map((number) => number.textContent)).toEqual([
      '12',
      ...Array.from({ length: 11 }, (_, index) => String(index + 1)),
    ]);
    expect(numbers[3]).toHaveAttribute('data-selected');
  });

  // A Vapor app without the interop plugin renders no virtual DOM component in a part.
  test.skipIf(inject('app') === 'vapor')(
    'the element of a component in `as` keeps the attributes of the component',
    async () => {
      const { root } = mount(TimeClockAs, { numberAs: ClassedSpan });
      await nextTick();
      const numbers = [...root.querySelectorAll('article span.Number')];
      expect(numbers).toHaveLength(12);
      expect(numbers.every((number) => number.className === 'Own Number')).toBe(true);
    },
  );

  test('the element slots render the elements of the developer, with the state; the attributes of the developer win; each part exposes its element', async () => {
    const { root, exposed } = mount(TimeClockSlots);
    await nextTick();
    const section = root.querySelector('section')!;
    expect(exposed.root.element).toBe(section);
    expect(section).toHaveAttribute('role', 'group');
    expect(section).toHaveAttribute('aria-label', 'Time');
    expect(section).toHaveAttribute('data-root-view', 'hour');
    const [trigger, pm] = root.querySelectorAll('button');
    expect(exposed.trigger.element).toBe(trigger);
    expect(trigger).toHaveAttribute('aria-label', 'Pick the hour');
    expect(trigger).toHaveAttribute('aria-pressed', 'true');
    expect(trigger).toHaveAttribute('data-active', 'true');
    expect(pm).toHaveAttribute('type', 'submit');
    expect(pm).toHaveAttribute('aria-pressed', 'true');
    const hand = root.querySelector('i')!;
    expect(exposed.hand.element).toBe(hand);
    expect(hand.className).toBe('Hand Mine');
    expect(hand.style.getPropertyValue('--time-clock-hand-angle')).toBe('90deg');
    expect(hand).toHaveAttribute('data-inner-hand', 'false');
    const numbers = [...root.querySelectorAll('b')];
    expect(numbers).toHaveLength(12);
    expect(numbers.every((number) => number.className === 'Number Mine')).toBe(true);
    expect(numbers[3]).toHaveAttribute('data-picked', 'true');
    expect(numbers[3]).toHaveAttribute('data-selected');
    expect(root.querySelector('input[type="range"]')).toHaveAttribute('aria-label', 'Hour');
  });
});

describe('press and drag', () => {
  test('a press selects the nearest number, a drag gives one change for each number, and the release commits and shows the next view', async () => {
    const log: string[] = [];
    const { face, range, group } = await mountClock({ clock: record(log) });
    await pressAt(face(), 90);
    expect(document.activeElement).toBe(range());
    expect(group).toHaveAttribute('data-dragging');
    await userEvent.pointer({ coords: at(face(), 95) });
    await userEvent.pointer({ coords: at(face(), 120) });
    await releaseAt(face(), 120);
    await nextTick();
    expect(log).toEqual([
      'valueChange 03:00:00 drag',
      'valueChange 04:00:00 drag',
      'valueCommitted 04:00:00 drag',
      'viewChange minute drag',
    ]);
    expect(group).not.toHaveAttribute('data-dragging');
    expect(group).toHaveAttribute('data-view', 'minute');
  });

  test('the distance from the center selects the ring of a 24-hour face', async () => {
    const log: string[] = [];
    const { face } = await mountClock({
      clock: record(log, { hourCycle: 24, granularity: 'hour' }),
    });
    // The outer ring is at 60 px from the center and the inner ring at 36 px, so a press at 70 px is
    // on the outer ring, which the edge of the face would not give.
    await pressAt(face(), 90, 0.36);
    await releaseAt(face(), 90, 0.36);
    await pressAt(face(), 90, 0.7);
    await releaseAt(face(), 90, 0.7);
    expect(log.filter((line) => line.startsWith('valueChange 1'))).toEqual([
      'valueChange 15:00:00 drag',
    ]);
    expect(log).toContain('valueChange 03:00:00 drag');
  });

  test('a press of an event that a script made selects, with no pointer capture and no error; a second pointer changes nothing', async () => {
    const log: string[] = [];
    const { face } = await mountClock({ clock: record(log) });
    const point = pointOnFace(face(), 180);
    const init = { ...point, button: 0, pointerId: 7, bubbles: true, cancelable: true };
    const second = { ...pointOnFace(face(), 90), button: 0, pointerId: 8, bubbles: true };
    face().dispatchEvent(new PointerEvent('pointerdown', init));
    face().dispatchEvent(new PointerEvent('pointerdown', second));
    face().dispatchEvent(new PointerEvent('pointerup', second));
    face().dispatchEvent(new PointerEvent('pointerup', init));
    expect(log).toEqual([
      'valueChange 06:00:00 drag',
      'valueCommitted 06:00:00 drag',
      'viewChange minute drag',
    ]);
  });

  test('a press that selects a disabled number commits nothing, and a selection goes into the limits', async () => {
    const log: string[] = [];
    const { face } = await mountClock({
      clock: record(log, { min: time('08:30'), max: time('10:00') }),
    });
    await pressAt(face(), 180);
    await releaseAt(face(), 180);
    expect(log).toEqual([]);
    await pressAt(face(), 240);
    await releaseAt(face(), 240);
    expect(log[0]).toBe('valueChange 08:30:00 drag');
  });

  test('`pointercancel` ends the press with no commit, and a face that goes away ends the drag', async () => {
    const log: string[] = [];
    const scene = reactive({ showFace: true });
    const { face, group } = await mountClock({ clock: record(log), scene });
    let pointerId = 0;
    face().addEventListener('pointerdown', (event) => (pointerId = event.pointerId));
    await pressAt(face(), 90);
    face().dispatchEvent(new PointerEvent('pointercancel', { pointerId, bubbles: true }));
    await releaseAt(face(), 90);
    expect(log).toEqual(['valueChange 03:00:00 drag']);
    await pressAt(face(), 120);
    expect(group).toHaveAttribute('data-dragging');
    scene.showFace = false;
    await nextTick();
    expect(group).not.toHaveAttribute('data-dragging');
  });
});

describe('keys', () => {
  test('arrows step, Page keys move 2 hours, Home and End go to the ends, and each key goes over a disabled hour', async () => {
    const log: string[] = [];
    const { range } = await mountClock({
      clock: record(log, {
        defaultValue: time('11:00'),
        hourCycle: 24,
        disabledTimes: (candidate: Temporal.PlainTime, view: string) =>
          view === 'hour' && candidate.hour === 12,
      }),
    });
    range().focus();
    await userEvent.keyboard('{ArrowRight}');
    await userEvent.keyboard('{ArrowLeft}{PageUp}{End}{Home}');
    expect(log).toEqual([
      'valueChange 13:00:00 keyboard',
      'valueChange 11:00:00 keyboard',
      'valueChange 13:00:00 keyboard',
      'valueChange 23:00:00 keyboard',
      'valueChange 00:00:00 keyboard',
    ]);
  });

  test('Enter and Space commit, Enter first gives the time that the face shows, and the arrows keep their direction right to left', async () => {
    const log: string[] = [];
    const { range, root } = await mountClock({ clock: record(log, { granularity: 'second' }) });
    root.dir = 'rtl';
    range().focus();
    await userEvent.keyboard('{Enter}');
    await userEvent.keyboard('{ArrowRight}');
    await userEvent.keyboard(' ');
    expect(log).toEqual([
      'valueChange 00:00:00 keyboard',
      'valueCommitted 00:00:00 keyboard',
      'viewChange minute keyboard',
      'valueChange 00:01:00 keyboard',
      'valueCommitted 00:01:00 keyboard',
      'viewChange second keyboard',
    ]);
  });

  // Chromium and WebKit submit a form at Enter in a range input (test/measurements/time-clock.test.ts).
  test('Enter in the range input submits no form', async () => {
    const form = document.body.appendChild(document.createElement('form'));
    form.append(document.createElement('button'));
    const submits: string[] = [];
    form.addEventListener('submit', (event) => {
      event.preventDefault();
      submits.push('submit');
    });
    mount(TimeClockParts, {}, form);
    await nextTick();
    form.querySelector<HTMLInputElement>('input[type="range"]')!.focus();
    await userEvent.keyboard('{Enter}');
    expect(submits).toEqual([]);
    form.remove();
  });

  test('a key with Alt, Ctrl or Meta stays native', async () => {
    const { range } = await mountClock();
    const event = new KeyboardEvent('keydown', {
      key: 'ArrowUp',
      altKey: true,
      bubbles: true,
      cancelable: true,
    });
    range().dispatchEvent(event);
    expect(event.defaultPrevented).toBe(false);
  });

  test('an `input` event of the range input selects its value; the input shows the time of the clock again after a cancel', async () => {
    const log: string[] = [];
    const clock = record(log, {
      defaultValue: time('03:00'),
      onValueChange: (value: unknown, details: TimeClockRootChangeEventDetails) => {
        log.push(`valueChange ${String(value)} ${details.reason}`);
        if (log.length > 1) details.cancel();
      },
    });
    const { range } = await mountClock({ clock });
    range().value = '5';
    range().dispatchEvent(new Event('input', { bubbles: true }));
    await settle();
    range().value = '7';
    range().dispatchEvent(new Event('input', { bubbles: true }));
    await settle();
    expect(log).toEqual(['valueChange 05:00:00 input-change', 'valueChange 07:00:00 input-change']);
    expect(range().value).toBe('5');
  });
});

describe('buttons', () => {
  test('a day period moves the time to the other half of the day, and is disabled when no hour of it is enabled', async () => {
    const log: string[] = [];
    const clock = record(log, { defaultValue: time('09:15') });
    const { byTestId } = await mountClock({ clock });
    await userEvent.click(byTestId('pm')!);
    expect(log).toEqual(['valueChange 21:15:00 item-press']);
    clock.max = time('11:00');
    await nextTick();
    expect((byTestId('pm') as HTMLButtonElement).disabled).toBe(true);
  });

  test('a trigger shows its view, also in a read-only clock; `details.cancel()` keeps the view', async () => {
    const log: string[] = [];
    const clock = record(log, { readonly: true, defaultValue: time('09:15') });
    const { byTestId, group } = await mountClock({ clock });
    await userEvent.click(byTestId('minute-trigger')!);
    expect(group).toHaveAttribute('data-view', 'minute');
    expect(group).toHaveAttribute('data-readonly');
    clock.onViewChange = (_view: string, details: { cancel(): void }) => details.cancel();
    await userEvent.click(byTestId('hour-trigger')!);
    expect(group).toHaveAttribute('data-view', 'minute');
    expect(log).toEqual(['viewChange minute trigger-press']);
  });

  test('a disabled clock disables the buttons and the range input', async () => {
    const { byTestId, range, group } = await mountClock({ clock: { disabled: true } });
    expect((byTestId('hour-trigger') as HTMLButtonElement).disabled).toBe(true);
    expect((byTestId('am') as HTMLButtonElement).disabled).toBe(true);
    expect(range().disabled).toBe(true);
    expect(group).toHaveAttribute('data-disabled');
  });
});
