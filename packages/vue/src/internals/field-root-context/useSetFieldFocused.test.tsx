import { expect, describe, it, onTestFinished } from 'vitest';
import { createSSRApp, defineComponent, KeepAlive, onActivated, shallowRef } from 'vue';
import {
  createRenderer,
  flushMicrotasks,
  renderOnServer,
  screen,
  takeReportedMessages,
  waitFor,
  within,
} from '#test-utils';
import FieldControlPart from '../../../test/fixtures/FieldControlPart.vue';
import FieldScope from '../../../test/fixtures/FieldScope.vue';
import FieldStateHydration from './FieldStateHydration.test.vue';

describe('useSetFieldFocused', () => {
  const { render } = createRenderer();

  // A browser does not need to send `focusout` when it removes the focused element. Chromium sends
  // the event, so a case that removes the element blocks it. Then only the code of the composable
  // can clear the focused state.
  function blockFocusout(element: HTMLElement) {
    element.addEventListener('focusout', (event) => event.stopImmediatePropagation(), true);
  }

  // A control can have focus that no `focusin` event reported, such as a control that has focus
  // before the hydration. A case that needs such a control blocks the event of its focus. Then only
  // the code of the composable can set the focused state.
  function blockFocusin(element: HTMLElement) {
    element.addEventListener('focusin', (event) => event.stopImmediatePropagation(), true);
  }

  describe('in a field', () => {
    it('sets the focused state when the control gets focus, and clears it when the control loses focus', async () => {
      await render(
        <FieldScope data-testid="root">
          <FieldControlPart data-testid="control" />
        </FieldScope>,
      );
      const control = screen.getByTestId('control');

      control.focus();
      await flushMicrotasks();

      expect(screen.getByTestId('root')).toHaveAttribute('data-focused');

      control.blur();
      await flushMicrotasks();

      expect(screen.getByTestId('root')).not.toHaveAttribute('data-focused');
    });

    it('does not set the focused state when a disabled control gets focus', async () => {
      await render(
        <FieldScope data-testid="root">
          <FieldControlPart data-testid="control" disabled />
        </FieldScope>,
      );
      const control = screen.getByTestId('control');

      control.focus();
      await flushMicrotasks();

      expect(control).toHaveFocus();
      expect(screen.getByTestId('root')).not.toHaveAttribute('data-focused');
    });

    it.each([
      { name: 'becomes disabled', other: { shown: true, disabled: true } },
      { name: 'goes away', other: { shown: false, disabled: false } },
    ])('keeps the focused state when another control of the field $name', async ({ other }) => {
      const otherControl = shallowRef({ shown: true, disabled: false });
      const Test = defineComponent(() => () => (
        <FieldScope data-testid="root">
          <FieldControlPart data-testid="focused" />
          {otherControl.value.shown && (
            <FieldControlPart data-testid="other" disabled={otherControl.value.disabled} />
          )}
        </FieldScope>
      ));
      await render(<Test />);
      const focused = screen.getByTestId('focused');
      focused.focus();
      await flushMicrotasks();
      expect(screen.getByTestId('root')).toHaveAttribute('data-focused');

      otherControl.value = other;
      await flushMicrotasks();

      expect(focused).toHaveFocus();
      expect(screen.getByTestId('root')).toHaveAttribute('data-focused');
    });

    describe('a control that becomes disabled', () => {
      async function renderControl() {
        const disabled = shallowRef(false);
        const Test = defineComponent(() => () => (
          <FieldScope data-testid="root">
            <FieldControlPart data-testid="control" disabled={disabled.value} />
          </FieldScope>
        ));
        await render(<Test />);
        return { disabled, control: screen.getByTestId('control') };
      }

      it('clears the focused state while the control keeps focus', async () => {
        const { disabled, control } = await renderControl();
        control.focus();
        await flushMicrotasks();
        expect(screen.getByTestId('root')).toHaveAttribute('data-focused');

        disabled.value = true;
        await flushMicrotasks();

        // An `aria-disabled` control stays focusable, so no `blur` event comes.
        expect(control).toHaveFocus();
        expect(screen.getByTestId('root')).not.toHaveAttribute('data-focused');
      });

      it('sets the focused state again when the control is enabled again and still has focus', async () => {
        const { disabled, control } = await renderControl();
        control.focus();
        await flushMicrotasks();
        disabled.value = true;
        await flushMicrotasks();
        expect(control).toHaveFocus();
        expect(screen.getByTestId('root')).not.toHaveAttribute('data-focused');

        disabled.value = false;
        await flushMicrotasks();

        expect(screen.getByTestId('root')).toHaveAttribute('data-focused');
      });
    });

    it('clears the focused state when the focused control goes away', async () => {
      const shown = shallowRef(true);
      const Test = defineComponent(() => () => (
        <FieldScope data-testid="root">
          {shown.value && <FieldControlPart data-testid="control" />}
        </FieldScope>
      ));
      await render(<Test />);
      const control = screen.getByTestId('control');
      control.focus();
      await flushMicrotasks();
      expect(screen.getByTestId('root')).toHaveAttribute('data-focused');
      blockFocusout(control);

      shown.value = false;
      await flushMicrotasks();

      expect(screen.getByTestId('root')).not.toHaveAttribute('data-focused');
    });

    it('clears the focused state when `KeepAlive` deactivates the focused control, and keeps it clear when `KeepAlive` activates the control', async () => {
      const shown = shallowRef(true);
      // `KeepAlive` keeps a component, so the control has a component around it.
      const Control = defineComponent(() => () => <FieldControlPart data-testid="control" />);
      const Test = defineComponent(() => () => (
        <FieldScope data-testid="root">
          <KeepAlive>{shown.value ? <Control /> : null}</KeepAlive>
        </FieldScope>
      ));
      await render(<Test />);
      const control = screen.getByTestId('control');
      control.focus();
      await flushMicrotasks();
      expect(screen.getByTestId('root')).toHaveAttribute('data-focused');
      blockFocusout(control);

      shown.value = false;
      await flushMicrotasks();

      expect(screen.getByTestId('root')).not.toHaveAttribute('data-focused');

      shown.value = true;
      await flushMicrotasks();

      expect(control).not.toHaveFocus();
      expect(screen.getByTestId('root')).not.toHaveAttribute('data-focused');
    });

    it('sets the focused state when `KeepAlive` activates a control that has focus with no focus event', async () => {
      const shown = shallowRef(true);
      const focusOnActivation = shallowRef(false);
      // `KeepAlive` runs the `onActivated` hooks of one branch from its last part to its first part.
      // The hook of this part then runs before the hook of the control, so the control has focus
      // when its own hook runs.
      const FocusOnActivation = defineComponent(() => {
        onActivated(() => {
          if (focusOnActivation.value) {
            screen.getByTestId('control').focus();
          }
        });
        return () => null;
      });
      const Control = defineComponent(() => () => (
        <>
          <FieldControlPart data-testid="control" />
          <FocusOnActivation />
        </>
      ));
      const Test = defineComponent(() => () => (
        <FieldScope data-testid="root">
          <KeepAlive>{shown.value ? <Control /> : null}</KeepAlive>
        </FieldScope>
      ));
      await render(<Test />);
      const control = screen.getByTestId('control');
      blockFocusin(control);
      shown.value = false;
      await flushMicrotasks();

      focusOnActivation.value = true;
      shown.value = true;
      await flushMicrotasks();

      expect(control).toHaveFocus();
      expect(screen.getByTestId('root')).toHaveAttribute('data-focused');
    });

    it('sets the focused state of a control that has focus before the hydration', async () => {
      const serverHtml = await renderOnServer(
        'src/internals/field-root-context/FieldStateHydration.test.vue',
      );
      const container = document.createElement('div');
      document.body.append(container);
      container.innerHTML = serverHtml;
      const root = within(container).getByTestId('root');
      const control = within(container).getByTestId('control');
      control.focus();
      expect(control).toHaveFocus();
      expect(root).not.toHaveAttribute('data-focused');

      const app = createSSRApp(FieldStateHydration);
      onTestFinished(() => {
        app.unmount();
        container.remove();
      });
      app.mount(container);

      await waitFor(() => expect(root).toHaveAttribute('data-focused'));
      // A mismatch makes Vue discard the server nodes and render new nodes.
      expect(within(container).getByTestId('root')).toBe(root);
      expect(within(container).getByTestId('control')).toBe(control);
      expect(takeReportedMessages()).toEqual([]);
    });

    it('calls `onFocusedChange` one time for each change of the focused state of the control', async () => {
      const changes: boolean[] = [];
      const disabled = shallowRef(false);
      const Test = defineComponent(() => () => (
        <FieldScope data-testid="root">
          <FieldControlPart
            data-testid="control"
            disabled={disabled.value}
            onFocusedChange={(focused: boolean) => changes.push(focused)}
          />
        </FieldScope>
      ));
      await render(<Test />);
      const control = screen.getByTestId('control');

      control.focus();
      await flushMicrotasks();
      expect(changes).toEqual([true]);

      disabled.value = true;
      await flushMicrotasks();
      expect(changes).toEqual([true, false]);

      disabled.value = false;
      await flushMicrotasks();
      expect(changes).toEqual([true, false, true]);

      control.blur();
      await flushMicrotasks();
      expect(changes).toEqual([true, false, true, false]);
    });
  });

  describe('with no field', () => {
    it('reports the focus and the blur of a control', async () => {
      const changes: boolean[] = [];
      await render(
        <div>
          <FieldControlPart
            data-testid="control"
            onFocusedChange={(focused: boolean) => changes.push(focused)}
          />
        </div>,
      );
      const control = screen.getByTestId('control');

      control.focus();
      await flushMicrotasks();
      expect(changes).toEqual([true]);

      control.blur();
      await flushMicrotasks();
      expect(changes).toEqual([true, false]);
    });

    it('reports nothing when a control that has no focus goes away', async () => {
      const changes: boolean[] = [];
      const shown = shallowRef(true);
      const Test = defineComponent(() => () => (
        <div>
          <FieldControlPart data-testid="focused" />
          {shown.value && (
            <FieldControlPart
              data-testid="other"
              onFocusedChange={(focused: boolean) => changes.push(focused)}
            />
          )}
        </div>
      ));
      await render(<Test />);
      screen.getByTestId('focused').focus();
      await flushMicrotasks();

      shown.value = false;
      await flushMicrotasks();

      expect(screen.queryByTestId('other')).toBeNull();
      expect(changes).toEqual([]);
    });

    it('clears the focused state of a control after another control took focus with no blur', async () => {
      const first = shallowRef<InstanceType<typeof FieldControlPart> | null>(null);
      const second = shallowRef<InstanceType<typeof FieldControlPart> | null>(null);
      const firstChanges: boolean[] = [];
      const Test = defineComponent(() => () => (
        <div>
          <FieldControlPart
            ref={first}
            onFocusedChange={(focused: boolean) => firstChanges.push(focused)}
          />
          <FieldControlPart ref={second} />
        </div>
      ));
      await render(<Test />);

      first.value!.setFocused(true);
      second.value!.setFocused(true);
      first.value!.setFocused(false);

      expect(firstChanges).toEqual([true, false]);
    });
  });
});
