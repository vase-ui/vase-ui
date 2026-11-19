import { describe, expect, it, onTestFinished } from 'vitest';
import { createApp, createCommentVNode, defineComponent, shallowRef, Transition } from 'vue';
import type { VNodeChild } from 'vue';
import { DateField } from '@vase-ui/vue/date-field';
import { DatePicker } from '@vase-ui/vue/date-picker';
import { DateRangePicker } from '@vase-ui/vue/date-range-picker';
import { TimeField } from '@vase-ui/vue/time-field';
import { TimePicker } from '@vase-ui/vue/time-picker';
import { createHeldBranch, createRenderer, flushMicrotasks, screen, waitFor } from '#test-utils';
import { recordVueWarnings } from '../../../../test/reportedMessages';
import { createPickerPartElements, usePickerPartElement } from './useDateTimePickerRoot';

describe('createPickerPartElements', () => {
  function mountElements() {
    const first = document.createElement('div');
    const second = document.createElement('div');
    document.body.append(first, second);
    onTestFinished(() => {
      first.remove();
      second.remove();
    });
    return { first, second };
  }

  it('gives the first element in the document, and not the one that registered first', () => {
    const { first, second } = mountElements();
    const parts = createPickerPartElements();
    onTestFinished(parts.add(() => second));
    onTestFinished(parts.add(() => first));

    expect(parts.first.value).toBe(first);
  });

  it('keeps the other elements when a part removes its getter', () => {
    const { first, second } = mountElements();
    const parts = createPickerPartElements();
    const removeFirst = parts.add(() => first);
    const removeSecond = parts.add(() => second);
    expect(parts.first.value).toBe(first);

    removeFirst();
    expect(parts.first.value).toBe(second);
    removeSecond();
    expect(parts.first.value).toBe(null);
  });

  it('gives the first registered element while no element is in the document', () => {
    const { first } = mountElements();
    const detached = document.createElement('div');
    const parts = createPickerPartElements();
    parts.add(() => null);
    parts.add(() => detached);
    const removeFirst = parts.add(() => first);
    expect(parts.first.value).toBe(first);

    removeFirst();
    expect(parts.first.value).toBe(detached);
  });
});

describe('usePickerPartElement', () => {
  const { render } = createRenderer();

  it('removes the getter before a leave transition removes the element', async () => {
    const parts = createPickerPartElements();
    const hasPart = shallowRef(true);
    const Part = defineComponent(() => {
      usePickerPartElement(parts, () => screen.queryByTestId('part'));
      return () => <button data-testid="part" />;
    });
    await render(() => (
      <Transition duration={{ enter: 0, leave: 100_000 }}>
        {hasPart.value ? <Part /> : null}
      </Transition>
    ));
    const element = screen.getByTestId('part');
    expect(parts.first.value).toBe(element);

    hasPart.value = false;
    await flushMicrotasks();

    expect(element).toBeInTheDocument();
    expect(parts.first.value).toBe(null);
  });
});

const today = Temporal.PlainDate.from('2026-11-14');
const rootProps = { open: true, locale: 'en-US', referenceDate: today.toPlainDateTime() };

describe.each([
  {
    name: 'DatePicker',
    parts: DatePicker,
    root: (children: VNodeChild) => <DatePicker.Root {...rootProps}>{children}</DatePicker.Root>,
    fields: () => (
      <DatePicker.Field data-testid="field">
        <DateField.Input />
      </DatePicker.Field>
    ),
    choice: () => <DatePicker.Calendar data-testid="choice" today={today} />,
    disabledAttribute: 'data-disabled',
    disabledValue: '',
  },
  {
    name: 'DateRangePicker',
    parts: DateRangePicker,
    root: (children: VNodeChild) => (
      <DateRangePicker.Root {...rootProps}>{children}</DateRangePicker.Root>
    ),
    fields: () => (
      <>
        <DateRangePicker.StartField data-testid="field">
          <DateField.Input />
        </DateRangePicker.StartField>
        <DateRangePicker.EndField>
          <DateField.Input />
        </DateRangePicker.EndField>
      </>
    ),
    choice: () => <DateRangePicker.Calendar data-testid="choice" today={today} />,
    disabledAttribute: 'data-disabled',
    disabledValue: '',
  },
  {
    name: 'TimePicker',
    parts: TimePicker,
    root: (children: VNodeChild) => <TimePicker.Root {...rootProps}>{children}</TimePicker.Root>,
    fields: () => (
      <TimePicker.Field data-testid="field">
        <TimeField.Input />
      </TimePicker.Field>
    ),
    choice: () => <TimePicker.List data-testid="choice" step={60} />,
    disabledAttribute: 'aria-disabled',
    disabledValue: 'true',
  },
])(
  '$name: VUE-112: a disabled fieldset',
  ({ parts, root, fields, choice, disabledAttribute, disabledValue }) => {
    const { render } = createRenderer();
    const { Trigger, Portal, Positioner, Popup } = parts;

    function picker(content: () => VNodeChild) {
      return root(
        <>
          {content()}
          <Portal>
            <Positioner data-testid="positioner" sideOffset={0}>
              <Popup aria-label="Choose" style={{ width: '100px', height: '50px' }}>
                {choice()}
              </Popup>
            </Positioner>
          </Portal>
        </>,
      );
    }

    function renderPicker(content: () => VNodeChild) {
      return render(() => picker(content));
    }

    function trigger(id = 'trigger') {
      return <Trigger data-testid={id}>Open</Trigger>;
    }

    it('reads the fieldset at the trigger after the field unmounts', async () => {
      const hasField = shallowRef(true);
      await renderPicker(() => (
        <>
          {hasField.value ? fields() : createCommentVNode()}
          <fieldset disabled>{trigger()}</fieldset>
        </>
      ));
      const target = await screen.findByTestId('choice');
      expect(target).not.toHaveAttribute(disabledAttribute);
      expect(screen.getByTestId('trigger')).toHaveAttribute('data-disabled');

      hasField.value = false;
      await waitFor(() => {
        expect(target).toHaveAttribute(disabledAttribute, disabledValue);
      });
    });

    it('reads no fieldset at the trigger after the trigger unmounts', async () => {
      const hasTrigger = shallowRef(true);
      await renderPicker(() => (
        <fieldset disabled>
          <Transition duration={{ enter: 0, leave: 100_000 }}>
            {hasTrigger.value ? trigger() : null}
          </Transition>
        </fieldset>
      ));
      const target = await screen.findByTestId('choice');
      expect(target).toHaveAttribute(disabledAttribute, disabledValue);

      hasTrigger.value = false;
      await flushMicrotasks();

      expect(screen.getByTestId('trigger')).toBeInTheDocument();
      expect(target).not.toHaveAttribute(disabledAttribute);
    });

    it('keeps the fieldset of the first trigger after the second trigger unmounts', async () => {
      const hasSecond = shallowRef(true);
      await renderPicker(() => (
        <fieldset disabled>
          {trigger()}
          {hasSecond.value ? trigger('second') : null}
        </fieldset>
      ));
      const target = await screen.findByTestId('choice');
      expect(target).toHaveAttribute(disabledAttribute, disabledValue);

      hasSecond.value = false;
      await flushMicrotasks();

      expect(screen.queryByTestId('second')).toBe(null);
      expect(target).toHaveAttribute(disabledAttribute, disabledValue);
    });

    it('reads the fieldset at the first trigger in the document', async () => {
      const addTriggers = shallowRef(false);
      await renderPicker(() => (
        <>
          <fieldset disabled>{addTriggers.value ? trigger('before') : null}</fieldset>
          {trigger()}
          {addTriggers.value ? trigger('after') : createCommentVNode()}
        </>
      ));
      const target = await screen.findByTestId('choice');
      expect(target).not.toHaveAttribute(disabledAttribute);

      addTriggers.value = true;
      await waitFor(() => {
        expect(target).toHaveAttribute(disabledAttribute, disabledValue);
      });
    });

    it('follows the first trigger after keyed fieldsets change places', async () => {
      const reversed = shallowRef(false);
      await renderPicker(() =>
        (reversed.value ? ['disabled', 'enabled'] : ['enabled', 'disabled']).map((id) => (
          <fieldset key={id} disabled={id === 'disabled'}>
            {trigger(id)}
          </fieldset>
        )),
      );
      const choice = await screen.findByTestId('choice');
      const disabledTrigger = screen.getByTestId('disabled');
      expect(choice).not.toHaveAttribute(disabledAttribute);

      reversed.value = true;
      await waitFor(() => {
        expect(choice).toHaveAttribute(disabledAttribute, disabledValue);
      });
      expect(screen.getByTestId('disabled')).toBe(disabledTrigger);

      reversed.value = false;
      await flushMicrotasks();
      expect(choice).not.toHaveAttribute(disabledAttribute);
    });

    it('reads the fieldset at the trigger while KeepAlive holds the field', async () => {
      const { HeldBranch, hide, show } = createHeldBranch(fields, { mounted: true });
      await renderPicker(() => (
        <>
          <HeldBranch />
          <fieldset disabled>{trigger()}</fieldset>
        </>
      ));
      const target = await screen.findByTestId('choice');
      expect(target).not.toHaveAttribute(disabledAttribute);

      await hide();
      await waitFor(() => {
        expect(target).toHaveAttribute(disabledAttribute, disabledValue);
      });

      await show();
      expect(target).not.toHaveAttribute(disabledAttribute);
    });

    it('positions the popup against the trigger while KeepAlive holds the field', async () => {
      const { HeldBranch, hide, show } = createHeldBranch(fields, { mounted: true });
      await renderPicker(() => (
        <>
          <div style={{ position: 'absolute', left: '40px', top: '50px' }}>
            <HeldBranch />
          </div>
          <div style={{ position: 'absolute', left: '180px', top: '80px' }}>{trigger()}</div>
        </>
      ));
      const positioner = await screen.findByTestId('positioner');
      const fieldLeft = screen.getByTestId('field').getBoundingClientRect().left;
      const button = screen.getByTestId('trigger').getBoundingClientRect();
      await waitFor(() => {
        expect(positioner.getBoundingClientRect().left).toBeCloseTo(fieldLeft, 0);
      });

      await hide();
      await waitFor(() => {
        expect(positioner.getBoundingClientRect().left).toBeCloseTo(button.left, 0);
      });
      expect(positioner.getBoundingClientRect().top).toBeCloseTo(button.bottom, 0);

      await show();
      await waitFor(() => {
        expect(positioner.getBoundingClientRect().left).toBeCloseTo(fieldLeft, 0);
      });
    });

    it('follows the field of an app that mounts in a detached element', async () => {
      const container = document.createElement('div');
      const app = createApp({
        render: () =>
          picker(() => (
            <>
              <fieldset disabled style={{ position: 'absolute', left: '40px', top: '50px' }}>
                {fields()}
              </fieldset>
              <div style={{ position: 'absolute', left: '180px', top: '120px' }}>{trigger()}</div>
            </>
          )),
      });
      recordVueWarnings(app);
      app.mount(container);
      onTestFinished(() => {
        app.unmount();
        container.remove();
      });
      await flushMicrotasks();

      document.body.append(container);
      const target = await screen.findByTestId('choice');
      const positioner = screen.getByTestId('positioner');
      const fieldLeft = screen.getByTestId('field').getBoundingClientRect().left;

      await waitFor(() => {
        expect(target).toHaveAttribute(disabledAttribute, disabledValue);
      });
      await waitFor(() => {
        expect(positioner.getBoundingClientRect().left).toBeCloseTo(fieldLeft, 0);
      });
    });
  },
);
