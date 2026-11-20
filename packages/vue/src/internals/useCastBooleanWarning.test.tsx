import { describe, expect, it } from 'vitest';
import { defineComponent, h, type Component } from 'vue';
import { AlertDialog } from '../alert-dialog';
import { Dialog } from '../dialog';
import { DatePicker } from '../date-picker';
import { TimePicker } from '../time-picker';
import { useForwardProps } from '../use-forward-props';
import { createRenderer, flushMicrotasks, isVaporApp, takeReportedMessages } from '#test-utils';
import { isCastToFalseWhenAbsent } from './callerProps';
import SlotHost from './SlotHost.test.vue';
import SlotHostUser from './SlotHostUser.test.vue';
import WrapperBindProps from './WrapperBindProps.test.vue';
import WrapperCast from './WrapperCast.test.vue';
import WrapperCastVapor from './WrapperCastVapor.test.vue';
import WrapperFalseDefault from './WrapperFalseDefault.test.vue';
import WrapperInSlot from './WrapperInSlot.test.vue';
import WrapperOuter from './WrapperOuter.test.vue';
import WrapperUndefined from './WrapperUndefined.test.vue';

function message(wrapper: string, part: string, prop: string) {
  return (
    `console.warn: Vase UI: <${wrapper}> gives \`${prop}: false\` to <${part}>, but its caller did not set \`${prop}\`. ` +
    'Vue sets an absent Boolean prop to `false`, so the part cannot use its default or the value of its parent. ' +
    `Give \`${prop}\` the default \`undefined\` in <${wrapper}>, or forward the props with \`useForwardProps\`.`
  );
}

// A wrapper that forwards its props with `useForwardProps`.
const WrapperForward = defineComponent({
  name: 'WrapperForward',
  props: { open: Boolean, closeOnSelect: Boolean },
  setup(props, { slots }) {
    const forwarded = useForwardProps(props);
    return () => <TimePicker.Root {...forwarded.value}>{slots.default?.()}</TimePicker.Root>;
  },
});

describe('useCastBooleanWarning', () => {
  const { render } = createRenderer();

  it('VUE-126: warns for a wrapper that casts an absent Boolean prop', async () => {
    await render(() => <WrapperCast>Content</WrapperCast>);
    expect(takeReportedMessages()).toEqual([
      message('WrapperCast.test', 'TimePicker.Root', 'open'),
      message('WrapperCast.test', 'TimePicker.Root', 'closeOnSelect'),
    ]);
    await render(() => <WrapperBindProps>Content</WrapperBindProps>);
    expect(takeReportedMessages()).toEqual([
      message('WrapperBindProps.test', 'TimePicker.Root', 'open'),
      message('WrapperBindProps.test', 'TimePicker.Root', 'closeOnSelect'),
    ]);
  });

  it('gives no warning when the caller sets false', async () => {
    await render(() => (
      <WrapperCast open={false} closeOnSelect={false}>
        Content
      </WrapperCast>
    ));
    expect(takeReportedMessages()).toEqual([]);
  });

  it('gives no warning for a caller value in kebab case', async () => {
    await render(() => h(WrapperCast, { open: false, 'close-on-select': false }));
    expect(takeReportedMessages()).toEqual([]);
  });

  it('gives no warning for the default undefined, for the default false, and with useForwardProps', async () => {
    await render(() => (
      <>
        <WrapperUndefined>Content</WrapperUndefined>
        <WrapperFalseDefault>Content</WrapperFalseDefault>
        <WrapperForward>Content</WrapperForward>
      </>
    ));
    expect(takeReportedMessages()).toEqual([]);
  });

  it('recognizes an explicit undefined default before a cast', () => {
    expect(isCastToFalseWhenAbsent({ type: Boolean })).toBe(true);
    expect(isCastToFalseWhenAbsent({ type: Boolean, default: undefined })).toBe(false);
  });

  it('gives no warning for an undefined binding', async () => {
    const { container } = await render(() => (
      <WrapperCast open={undefined} closeOnSelect={undefined}>
        Kept content
      </WrapperCast>
    ));
    expect(takeReportedMessages()).toEqual([]);
    expect(container.textContent).toBe('Kept content');
  });

  it('warns one time for a wrapper that many instances use', async () => {
    await render(() => (
      <>
        {[1, 2, 3].map((key) => (
          <WrapperCast key={key} closeOnSelect={false}>
            Content
          </WrapperCast>
        ))}
      </>
    ));
    expect(takeReportedMessages()).toEqual([
      message('WrapperCast.test', 'TimePicker.Root', 'open'),
    ]);
  });

  it('names the outer wrapper of two', async () => {
    await render(() => <WrapperOuter>Content</WrapperOuter>);
    expect(takeReportedMessages()).toEqual([
      message('WrapperOuter.test', 'TimePicker.Root', 'open'),
    ]);
  });

  it('finds the wrapper when the part is in the slot of another part', async () => {
    await render(() => <WrapperInSlot>Content</WrapperInSlot>);
    expect(takeReportedMessages()).toEqual([
      message('WrapperInSlot.test', 'Tooltip.Trigger', 'closeOnClick'),
    ]);
  });

  it('gives no warning for an explicit false in the slot of a component that declares the same prop', async () => {
    await render(() => <SlotHostUser />);
    await render(() => (
      <SlotHost>
        <TimePicker.Root open={false}>Content</TimePicker.Root>
      </SlotHost>
    ));
    await render(() => <SlotHost>{{ default: () => <TimePicker.Root open={false} /> }}</SlotHost>);
    expect(takeReportedMessages()).toEqual([]);
  });

  it('gives no warning for a vnode that no render made', async () => {
    await render(<SlotHost>{{ default: () => <TimePicker.Root open={false} /> }}</SlotHost>);
    await render(h(SlotHost, null, () => h(TimePicker.Root as Component, { open: false })));
    expect(takeReportedMessages()).toEqual([]);
  });

  it('gives no warning for array children', async () => {
    await render(() => h(SlotHost, null, [h(TimePicker.Root as Component, { open: false })]));
    // Vue reports the array slot itself, independently of the Boolean check.
    expect(takeReportedMessages()).toEqual([
      expect.stringContaining('Non-function value encountered for default slot.'),
    ]);
  });

  it('warns for a JSX wrapper with a run-time Boolean prop', async () => {
    const Wrapper = defineComponent({
      name: 'MyAlertDialog',
      props: { open: Boolean },
      setup(props) {
        return () => <AlertDialog.Root open={props.open} />;
      },
    });
    await render(() => <Wrapper />);
    expect(takeReportedMessages()).toEqual([message('MyAlertDialog', 'AlertDialog.Root', 'open')]);
  });

  it('gives one warning for a part that gives the prop to another part', async () => {
    const Wrapper = defineComponent({
      name: 'MyDatePickerPopup',
      props: { finalFocus: Boolean },
      setup(props) {
        return () => <DatePicker.Popup finalFocus={props.finalFocus} aria-label="Example" />;
      },
    });
    await render(() => (
      <DatePicker.Root>
        <DatePicker.Portal keepMounted>
          <DatePicker.Positioner>
            <Wrapper />
          </DatePicker.Positioner>
        </DatePicker.Portal>
      </DatePicker.Root>
    ));
    await flushMicrotasks();
    expect(takeReportedMessages()).toEqual([
      message('MyDatePickerPopup', 'DatePicker.Popup', 'finalFocus'),
    ]);
  });

  it('warns for the default true of Dialog.Root modal', async () => {
    const Wrapper = defineComponent({
      name: 'MyDialog',
      props: { modal: Boolean },
      setup(props) {
        return () => <Dialog.Root modal={props.modal} />;
      },
    });
    await render(() => <Wrapper />);
    expect(takeReportedMessages()).toEqual([message('MyDialog', 'Dialog.Root', 'modal')]);
  });

  it('warns for Dialog.Trigger nativeButton', async () => {
    const Wrapper = defineComponent({
      name: 'MyTrigger',
      props: { nativeButton: Boolean },
      setup(props) {
        return () => (
          <Dialog.Root>
            <Dialog.Trigger as="span" nativeButton={props.nativeButton}>
              Action
            </Dialog.Trigger>
          </Dialog.Root>
        );
      },
    });
    await render(() => <Wrapper />);
    expect(takeReportedMessages()).toEqual([
      message('MyTrigger', 'Dialog.Trigger', 'nativeButton'),
    ]);
  });

  it('warns for the Boolean union of Dialog.Popup initialFocus', async () => {
    const Wrapper = defineComponent({
      name: 'MyDialogPopup',
      props: { initialFocus: Boolean },
      setup(props) {
        return () => <Dialog.Popup initialFocus={props.initialFocus} aria-label="Example" />;
      },
    });
    await render(() => (
      <Dialog.Root>
        <Dialog.Portal keepMounted>
          <Wrapper />
        </Dialog.Portal>
      </Dialog.Root>
    ));
    expect(takeReportedMessages()).toEqual([
      message('MyDialogPopup', 'Dialog.Popup', 'initialFocus'),
    ]);
  });

  it('checks only at setup', async () => {
    const Wrapper = defineComponent({
      name: 'MyAlertDialog',
      props: { open: Boolean },
      setup(props) {
        return () => <AlertDialog.Root open={props.open} />;
      },
    });
    const { rerender } = await render(() => <Wrapper open={false} />);
    await rerender(() => <Wrapper />);
    expect(takeReportedMessages()).toEqual([]);
  });

  it('names a wrapper with no name', async () => {
    const Wrapper = defineComponent({
      props: { open: Boolean },
      setup(props) {
        return () => <AlertDialog.Root open={props.open} />;
      },
    });
    await render(() => <Wrapper />);
    expect(takeReportedMessages()).toEqual([
      expect.stringContaining('A component with no name gives `open: false` to <AlertDialog.Root>'),
    ]);
  });

  it.runIf(isVaporApp)('gives no warning for a Vapor wrapper that casts', async () => {
    await render(() => <WrapperCastVapor />);
    expect(takeReportedMessages()).toEqual([]);
  });
});
