import { expect, describe, it, onTestFinished } from 'vitest';
import { Teleport, defineComponent, shallowRef } from 'vue';
import type { ComponentPublicInstance } from 'vue';
import {
  createHeldBranch,
  createRenderer,
  fireEvent,
  flushMicrotasks,
  screen,
  within,
} from '#test-utils';
import * as Select from '../../select/index.parts';
import LabelPosition from './LabelPosition.test.vue';
import { createLabelIdRegistry } from './createLabelIdRegistry';
import type { RegisterId } from './createIdRegistry';
import { useLabel } from './useLabel';

// A container for `<Teleport>` in a shadow root. The shadow root is in the document, or in another
// shadow root.
function createShadowContainer(parent: Node = document.body) {
  const host = document.createElement('div');
  const shadowRoot = host.attachShadow({ mode: 'open' });
  const container = document.createElement('div');
  shadowRoot.append(container);
  parent.appendChild(host);
  onTestFinished(() => host.remove());
  return { host, shadowRoot, container };
}

/** A label part: a `<label>`, or a `<div>` when `native` is `false`. */
const TestLabel = defineComponent(
  (
    props: { id?: string; native?: boolean; controlId?: string; registerLabelId?: RegisterId },
    { attrs, slots },
  ) => {
    const element = shallowRef<HTMLElement | null>(null);
    const labelProps = useLabel({
      id: () => props.id,
      element,
      native: () => props.native ?? true,
      fallbackControlId: () => props.controlId,
      registerLabelId: (source, getId) => props.registerLabelId?.(source, getId),
    });
    return () =>
      props.native === false ? (
        <div ref={element} {...labelProps.value} {...attrs}>
          {slots.default?.()}
        </div>
      ) : (
        <label ref={element} {...labelProps.value} {...attrs}>
          {slots.default?.()}
        </label>
      );
  },
  { props: ['id', 'native', 'controlId', 'registerLabelId'], inheritAttrs: false },
);

/** A control that a label names by its id. */
function Control(props: { id: string; testid?: string }) {
  return (
    <span
      role="checkbox"
      tabindex="0"
      aria-checked="false"
      id={props.id}
      data-testid={props.testid}
    />
  );
}

describe('useLabel', () => {
  const { render } = createRenderer();

  describe.each(['Select.Label'])('%s', () => {
    const TestControl = defineComponent(() => () => {
      return (
        <Select.Root>
          <Select.Label>Country</Select.Label>
          <Select.Trigger id="country">Choose a country</Select.Trigger>
          <Select.Portal>
            <Select.Positioner>
              <Select.Popup>
                <Select.List>
                  <Select.Item value="fr">
                    <Select.ItemText>France</Select.ItemText>
                  </Select.Item>
                </Select.List>
              </Select.Popup>
            </Select.Positioner>
          </Select.Portal>
        </Select.Root>
      );
    });

    it('focuses the trigger without opening the popup in the document', async () => {
      const { user } = await render(<TestControl />);
      const trigger = screen.getByRole('combobox', { name: 'Country' });

      await user.click(screen.getByText('Country'));

      expect(trigger).toHaveFocus();
      expect(trigger).toHaveAttribute('aria-expanded', 'false');
    });

    it.each([false, true])(
      'focuses the trigger in its shadow root without opening the popup (outer matching ID: %s)',
      async (outerMatchingId) => {
        const { host, shadowRoot, container } = createShadowContainer();
        const { user } = await render(
          <>
            {outerMatchingId && <input id="country" aria-label="Unrelated control" />}
            <Teleport to={container}>
              <TestControl />
            </Teleport>
          </>,
        );
        const trigger = within(container).getByRole('combobox', { name: 'Country' });

        await user.click(within(container).getByText('Country'));

        expect(shadowRoot.activeElement).toBe(trigger);
        expect(document.activeElement).toBe(host);
        expect(trigger).toHaveAttribute('aria-expanded', 'false');
      },
    );
  });

  it('does not throw when a label is clicked in a detached root', async () => {
    const container = document.createElement('div');

    const { unmount } = await render(
      <Teleport to={container}>
        <Select.Root>
          <Select.Label>Country</Select.Label>
          <Select.Trigger id="country">Choose a country</Select.Trigger>
        </Select.Root>
      </Teleport>,
    );

    const errors: ErrorEvent[] = [];
    function handleError(event: ErrorEvent) {
      event.preventDefault();
      errors.push(event);
    }
    window.addEventListener('error', handleError);

    try {
      within(container).getByText('Country').click();
      await flushMicrotasks();

      expect(errors).toHaveLength(0);
    } finally {
      window.removeEventListener('error', handleError);
      unmount();
    }
  });

  it('does not focus the control when a composed click originates inside a nested button', async () => {
    const Test = defineComponent(() => {
      const element = shallowRef<HTMLElement | null>(null);
      const labelProps = useLabel({ element, fallbackControlId: 'control' });

      function attachShadowTarget(host: Element | ComponentPublicInstance | null) {
        const span = host as HTMLSpanElement | null;
        if (span && !span.shadowRoot) {
          const target = document.createElement('span');
          target.dataset.testid = 'shadow-target';
          span.attachShadow({ mode: 'open' }).appendChild(target);
        }
      }

      return () => (
        <>
          <div ref={element} {...labelProps.value}>
            Label
            <button type="button">
              Action
              <span ref={attachShadowTarget} />
            </button>
          </div>
          <input id="control" />
        </>
      );
    });

    await render(<Test />);

    const button = screen.getByRole('button');
    const target = button.querySelector('span')?.shadowRoot?.querySelector('span');
    const control = screen.getByRole('textbox');

    expect(target).not.toBeNull();

    target?.dispatchEvent(new MouseEvent('click', { bubbles: true, composed: true }));
    await flushMicrotasks();

    expect(control).not.toHaveFocus();
  });

  it('focuses a control in the light DOM from a label in a shadow root', async () => {
    const { container } = createShadowContainer();
    const { user } = await render(
      <Select.Root>
        <Teleport to={container}>
          <Select.Label>Country</Select.Label>
        </Teleport>
        <Select.Trigger id="country">Choose a country</Select.Trigger>
      </Select.Root>,
    );

    await user.click(within(container).getByText('Country'));

    expect(screen.getByRole('combobox')).toHaveFocus();
  });

  it('focuses a control in an ancestor shadow root from a label in a nested shadow root', async () => {
    const outer = createShadowContainer();
    const inner = createShadowContainer(outer.shadowRoot);
    const { user } = await render(
      <Select.Root>
        <Teleport to={inner.container}>
          <Select.Label>Country</Select.Label>
        </Teleport>
        <Teleport to={outer.container}>
          <Select.Trigger id="country">Choose a country</Select.Trigger>
        </Teleport>
      </Select.Root>,
    );

    await user.click(within(inner.container).getByText('Country'));

    expect(outer.shadowRoot.activeElement).toBe(within(outer.container).getByRole('combobox'));
  });

  describe('with a label and a control', () => {
    it('focuses the control when a label that is not native is clicked', async () => {
      const { user } = await render(
        <>
          <TestLabel native={false} controlId="control" data-testid="label">
            Label
          </TestLabel>
          <Control id="control" testid="control" />
        </>,
      );

      await user.click(screen.getByTestId('label'));

      expect(screen.getByTestId('control')).toHaveFocus();
    });

    it.each([
      { name: 'the document has no element with the same id', outerMatchingId: false },
      { name: 'the document has an element with the same id', outerMatchingId: true },
    ])(
      'focuses the control in the shadow root of the label when $name',
      async ({ outerMatchingId }) => {
        const { host, shadowRoot, container } = createShadowContainer();
        const { user } = await render(
          <>
            {outerMatchingId && <input id="country" aria-label="Unrelated control" />}
            <Teleport to={container}>
              <TestLabel native={false} controlId="country">
                Country
              </TestLabel>
              <Control id="country" testid="control" />
            </Teleport>
          </>,
        );

        await user.click(within(container).getByText('Country'));

        expect(shadowRoot.activeElement).toBe(within(container).getByTestId('control'));
        expect(document.activeElement).toBe(host);
      },
    );

    it('focuses a control in the light DOM from a label in a shadow root', async () => {
      const { container } = createShadowContainer();
      const { user } = await render(
        <>
          <Teleport to={container}>
            <TestLabel native={false} controlId="country">
              Country
            </TestLabel>
          </Teleport>
          <Control id="country" testid="control" />
        </>,
      );

      await user.click(within(container).getByText('Country'));

      expect(screen.getByTestId('control')).toHaveFocus();
    });

    it('focuses a control in an ancestor shadow root from a label in a nested shadow root', async () => {
      const outer = createShadowContainer();
      const inner = createShadowContainer(outer.shadowRoot);
      const { user } = await render(
        <>
          <Teleport to={inner.container}>
            <TestLabel native={false} controlId="country">
              Country
            </TestLabel>
          </Teleport>
          <Teleport to={outer.container}>
            <Control id="country" testid="control" />
          </Teleport>
        </>,
      );

      await user.click(within(inner.container).getByText('Country'));

      expect(outer.shadowRoot.activeElement).toBe(within(outer.container).getByTestId('control'));
    });

    it('reports nothing and focuses nothing when a label in a container outside the document is clicked', async () => {
      const container = document.createElement('div');
      await render(
        <>
          <Teleport to={container}>
            <TestLabel native={false} controlId="country">
              Country
            </TestLabel>
            <Control id="country" />
          </Teleport>
        </>,
      );

      const errors: ErrorEvent[] = [];
      function handleError(event: ErrorEvent) {
        event.preventDefault();
        errors.push(event);
      }
      window.addEventListener('error', handleError);

      try {
        within(container).getByText('Country').click();
        await flushMicrotasks();

        expect(errors).toHaveLength(0);
        expect(document.activeElement).toBe(document.body);
      } finally {
        window.removeEventListener('error', handleError);
      }
    });

    it('gives a native label `for` with the id of the control and moves no focus itself', async () => {
      await render(
        <>
          <TestLabel controlId="control" data-testid="label">
            Label
          </TestLabel>
          <Control id="control" testid="control" />
        </>,
      );
      const label = screen.getByTestId('label');
      const control = screen.getByTestId('control');

      expect(control.id).not.toBe('');
      expect(label).toHaveAttribute('for', control.id);

      await fireEvent.mouseDown(label);

      expect(control).not.toHaveFocus();
    });

    it.each([
      { name: 'a native label', native: true, type: 'mouseDown' },
      { name: 'a label that is not native', native: false, type: 'click' },
    ] as const)('prevents the default of a double $type on $name', async ({ native, type }) => {
      await render(
        <TestLabel native={native} data-testid="label">
          Label
        </TestLabel>,
      );
      const label = screen.getByTestId('label');

      expect(await fireEvent[type](label, { detail: 1 })).toBe(true);
      expect(await fireEvent[type](label, { detail: 2 })).toBe(false);
    });

    it('prevents the default of a pointerdown on a label that is not native, and on no other label', async () => {
      await render(
        <>
          <TestLabel data-testid="native">Label</TestLabel>
          <TestLabel native={false} data-testid="not-native">
            Label
          </TestLabel>
        </>,
      );

      expect(await fireEvent.pointerDown(screen.getByTestId('native'))).toBe(true);
      expect(await fireEvent.pointerDown(screen.getByTestId('not-native'))).toBe(false);
    });

    describe('param: controlElement', () => {
      it('focuses the control element, and not the element that has the id of the control', async () => {
        const Test = defineComponent(() => {
          const element = shallowRef<HTMLElement | null>(null);
          const controlElement = shallowRef<HTMLElement | null>(null);
          const labelProps = useLabel({ element, fallbackControlId: 'named', controlElement });
          return () => (
            <>
              <div ref={element} data-testid="label" {...labelProps.value}>
                Label
              </div>
              <input id="named" />
              <input ref={controlElement} data-testid="control" />
            </>
          );
        });
        const { user } = await render(<Test />);

        await user.click(screen.getByTestId('label'));

        expect(screen.getByTestId('control')).toHaveFocus();
      });
    });

    describe('param: registerLabelId', () => {
      it('registers the id of the label, and removes it when the label goes away', async () => {
        const { labelId, registerLabelId } = createLabelIdRegistry();
        const Test = defineComponent(
          (props: { show: boolean }) => () =>
            props.show ? <TestLabel registerLabelId={registerLabelId} data-testid="label" /> : null,
          { props: ['show'] },
        );

        const { rerender } = await render(<Test show />);

        expect(labelId.value).toBeTruthy();
        expect(labelId.value).toBe(screen.getByTestId('label').id);

        await rerender(<Test show={false} />);

        expect(labelId.value).toBeUndefined();
      });

      it('keeps the id of the label that is left, and has no id when no label is left', async () => {
        const { labelId, registerLabelId } = createLabelIdRegistry();
        const Test = defineComponent(
          (props: { first: boolean; second: boolean }) => () => (
            <>
              {props.first && <TestLabel id="first-label" registerLabelId={registerLabelId} />}
              {props.second && <TestLabel id="second-label" registerLabelId={registerLabelId} />}
            </>
          ),
          { props: ['first', 'second'] },
        );

        const { rerender } = await render(<Test first second />);
        expect(labelId.value).toBe('second-label');

        await rerender(<Test first second={false} />);

        expect(labelId.value).toBe('first-label');

        await rerender(<Test first={false} second={false} />);

        expect(labelId.value).toBeUndefined();
      });

      // The compiled template of the fixture mounts the new label before it unmounts the old label.
      // A render function in TSX reuses the label component, so it does not show this order.
      it('keeps the id of the label when a label before the control replaces a label after it', async () => {
        const { labelId, registerLabelId } = createLabelIdRegistry();
        const tree = (labelBeforeControl: boolean) => (
          <LabelPosition
            labelBeforeControl={labelBeforeControl}
            labelId="part-label"
            registerLabelId={registerLabelId}
          />
        );
        const { rerender } = await render(tree(false));
        expect(labelId.value).toBe('part-label');

        await rerender(tree(true));

        expect(labelId.value).toBe('part-label');
      });

      it('keeps a label that the part does not own out of the registry of the part', async () => {
        const { labelId, registerLabelId } = createLabelIdRegistry();
        const Test = defineComponent(
          (props: { ownLabel: boolean }) => () => (
            <>
              <TestLabel id="other-label" />
              {props.ownLabel && <TestLabel id="own-label" registerLabelId={registerLabelId} />}
            </>
          ),
          { props: ['ownLabel'] },
        );

        const { rerender } = await render(<Test ownLabel />);
        expect(labelId.value).toBe('own-label');

        await rerender(<Test ownLabel={false} />);

        expect(labelId.value).toBeUndefined();
      });
    });

    describe('KeepAlive', () => {
      it('gives no id to the root while KeepAlive holds a label that mounted in a held branch', async () => {
        const { labelId, registerLabelId } = createLabelIdRegistry();
        const HeldLabel = defineComponent(() => {
          const element = shallowRef<HTMLElement | null>(null);
          const labelProps = useLabel({ id: 'held-label', element, registerLabelId });
          return () => <div ref={element} {...labelProps.value} />;
        });
        const { HeldBranch, mountWhileHeld, show } = createHeldBranch(() => <HeldLabel />);
        await render(() => <HeldBranch />);

        await mountWhileHeld();
        expect(labelId.value).toBeUndefined();

        await show();
        expect(labelId.value).toBe('held-label');
      });
    });
  });
});
