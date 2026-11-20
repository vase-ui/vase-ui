import { describe, expect, it } from 'vitest';
import { defineComponent, h } from 'vue';
import { DatePicker } from '../date-picker';
import * as Menu from '../menu/index.parts';
import { Menubar } from '../menubar';
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
  props: { modal: Boolean, loopFocus: Boolean },
  setup(props, { slots }) {
    const forwarded = useForwardProps(props);
    return () => <Menubar {...forwarded.value}>{slots.default?.()}</Menubar>;
  },
});

describe('useCastBooleanWarning', () => {
  const { render } = createRenderer();

  it('VUE-126: warns for a wrapper that casts an absent Boolean prop', async () => {
    await render(() => <WrapperCast>Content</WrapperCast>);
    expect(takeReportedMessages()).toEqual([
      message('WrapperCast.test', 'Menubar', 'modal'),
      message('WrapperCast.test', 'Menubar', 'loopFocus'),
    ]);
    await render(() => <WrapperBindProps>Content</WrapperBindProps>);
    expect(takeReportedMessages()).toEqual([
      message('WrapperBindProps.test', 'Menubar', 'modal'),
      message('WrapperBindProps.test', 'Menubar', 'loopFocus'),
    ]);
  });

  it('gives no warning when the caller sets false', async () => {
    await render(() => (
      <WrapperCast modal={false} loopFocus={false}>
        Content
      </WrapperCast>
    ));
    expect(takeReportedMessages()).toEqual([]);
  });

  it('gives no warning for a caller value in kebab case', async () => {
    await render(() => h(WrapperCast, { modal: false, 'loop-focus': false }));
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
      <WrapperCast modal={undefined} loopFocus={undefined}>
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
          <WrapperCast key={key} loopFocus={false}>
            Content
          </WrapperCast>
        ))}
      </>
    ));
    expect(takeReportedMessages()).toEqual([message('WrapperCast.test', 'Menubar', 'modal')]);
  });

  it('names the outer wrapper of two', async () => {
    await render(() => <WrapperOuter>Content</WrapperOuter>);
    expect(takeReportedMessages()).toEqual([message('WrapperOuter.test', 'Menubar', 'modal')]);
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
        <Menubar modal={false}>Content</Menubar>
      </SlotHost>
    ));
    await render(() => <SlotHost>{{ default: () => <Menubar modal={false} /> }}</SlotHost>);
    expect(takeReportedMessages()).toEqual([]);
  });

  it('gives no warning for a vnode that no render made', async () => {
    await render(<SlotHost>{{ default: () => <Menubar modal={false} /> }}</SlotHost>);
    await render(h(SlotHost, null, () => h(Menubar, { modal: false })));
    expect(takeReportedMessages()).toEqual([]);
  });

  it('gives no warning for array children', async () => {
    await render(() => h(SlotHost, null, [h(Menubar, { modal: false })]));
    // Vue reports the array slot itself, independently of the Boolean check.
    expect(takeReportedMessages()).toEqual([
      expect.stringContaining('Non-function value encountered for default slot.'),
    ]);
  });

  it('warns for a JSX wrapper with a run-time Boolean prop', async () => {
    const Wrapper = defineComponent({
      name: 'MyMenu',
      props: { open: Boolean },
      setup(props) {
        return () => <Menu.Root open={props.open} />;
      },
    });
    await render(() => <Wrapper />);
    expect(takeReportedMessages()).toEqual([message('MyMenu', 'Menu.Root', 'open')]);
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

  it('warns for the default true of Menu.Root modal', async () => {
    const Wrapper = defineComponent({
      name: 'MyMenu',
      props: { modal: Boolean },
      setup(props) {
        return () => <Menu.Root modal={props.modal} />;
      },
    });
    await render(() => <Wrapper />);
    expect(takeReportedMessages()).toEqual([message('MyMenu', 'Menu.Root', 'modal')]);
  });

  it('warns for Menu.Trigger nativeButton', async () => {
    const Wrapper = defineComponent({
      name: 'MyTrigger',
      props: { nativeButton: Boolean },
      setup(props) {
        return () => (
          <Menu.Root>
            <Menu.Trigger as="span" nativeButton={props.nativeButton}>
              Action
            </Menu.Trigger>
          </Menu.Root>
        );
      },
    });
    await render(() => <Wrapper />);
    expect(takeReportedMessages()).toEqual([message('MyTrigger', 'Menu.Trigger', 'nativeButton')]);
  });

  it('warns for the Boolean union of Menu.Popup finalFocus', async () => {
    const Wrapper = defineComponent({
      name: 'MyMenuPopup',
      props: { finalFocus: Boolean },
      setup(props) {
        return () => <Menu.Popup finalFocus={props.finalFocus} aria-label="Example" />;
      },
    });
    await render(() => (
      <Menu.Root>
        <Menu.Portal keepMounted>
          <Menu.Positioner>
            <Wrapper />
          </Menu.Positioner>
        </Menu.Portal>
      </Menu.Root>
    ));
    await flushMicrotasks();
    expect(takeReportedMessages()).toEqual([message('MyMenuPopup', 'Menu.Popup', 'finalFocus')]);
  });

  it('checks only at setup', async () => {
    const Wrapper = defineComponent({
      name: 'MyMenu',
      props: { open: Boolean },
      setup(props) {
        return () => <Menu.Root open={props.open} />;
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
        return () => <Menu.Root open={props.open} />;
      },
    });
    await render(() => <Wrapper />);
    expect(takeReportedMessages()).toEqual([
      expect.stringContaining('A component with no name gives `open: false` to <Menu.Root>'),
    ]);
  });

  it.runIf(isVaporApp)('gives no warning for a Vapor wrapper that casts', async () => {
    await render(() => <WrapperCastVapor />);
    expect(takeReportedMessages()).toEqual([]);
  });
});
