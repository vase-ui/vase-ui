import { expect, describe, it, onTestFinished, vi } from 'vitest';
import { Teleport, defineComponent } from 'vue';
import type { ComponentPublicInstance } from 'vue';
import { Field } from '@vase-ui/vue/field';
import { createRenderer, fireEvent, flushMicrotasks, screen, within } from '#test-utils';
import LabelableControl from '../../../test/fixtures/LabelableControl.vue';
import LabelableLabel from '../../../test/fixtures/LabelableLabel.vue';
import LabelableScope from '../../../test/fixtures/LabelableScope.vue';
import LabelableLabelPosition from './LabelableLabelPosition.test.vue';
import { createLabelIdRegistry } from './createLabelIdRegistry';
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

describe('useLabel', () => {
  const { render } = createRenderer();

  it('does not focus the control when a composed click originates inside a nested button', async () => {
    const Test = defineComponent(() => {
      const labelProps = useLabel({ fallbackControlId: 'control' });

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
          <div {...labelProps.value}>
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

  it('preserves native label activation inside a shadow root', async () => {
    const { shadowRoot, container } = createShadowContainer();
    const { user } = await render(
      <Teleport to={container}>
        <Field.Root>
          <Field.Label>Name</Field.Label>
          <Field.Control />
        </Field.Root>
      </Teleport>,
    );
    const control = within(container).getByRole('textbox', { name: 'Name' });

    await user.click(within(container).getByText('Name'));

    expect(shadowRoot.activeElement).toBe(control);
  });

  describe('with a fixture label and control', () => {
    it('focuses the control of the provider when a label that is not native is clicked', async () => {
      const { user } = await render(
        <LabelableScope>
          <LabelableLabel native={false} data-testid="label">
            Label
          </LabelableLabel>
          <LabelableControl data-testid="control" />
        </LabelableScope>,
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
          <LabelableScope>
            {outerMatchingId && <input id="country" aria-label="Unrelated control" />}
            <Teleport to={container}>
              <LabelableLabel native={false}>Country</LabelableLabel>
              <LabelableControl id="country" data-testid="control" />
            </Teleport>
          </LabelableScope>,
        );

        await user.click(within(container).getByText('Country'));

        expect(shadowRoot.activeElement).toBe(within(container).getByTestId('control'));
        expect(document.activeElement).toBe(host);
      },
    );

    it('focuses a control in the light DOM from a label in a shadow root', async () => {
      const { container } = createShadowContainer();
      const { user } = await render(
        <LabelableScope>
          <Teleport to={container}>
            <LabelableLabel native={false}>Country</LabelableLabel>
          </Teleport>
          <LabelableControl id="country" data-testid="control" />
        </LabelableScope>,
      );

      await user.click(within(container).getByText('Country'));

      expect(screen.getByTestId('control')).toHaveFocus();
    });

    it('focuses a control in an ancestor shadow root from a label in a nested shadow root', async () => {
      const outer = createShadowContainer();
      const inner = createShadowContainer(outer.shadowRoot);
      const { user } = await render(
        <LabelableScope>
          <Teleport to={inner.container}>
            <LabelableLabel native={false}>Country</LabelableLabel>
          </Teleport>
          <Teleport to={outer.container}>
            <LabelableControl id="country" data-testid="control" />
          </Teleport>
        </LabelableScope>,
      );

      await user.click(within(inner.container).getByText('Country'));

      expect(outer.shadowRoot.activeElement).toBe(within(outer.container).getByTestId('control'));
    });

    it('reports nothing and focuses nothing when a label in a container outside the document is clicked', async () => {
      const container = document.createElement('div');
      await render(
        <LabelableScope>
          <Teleport to={container}>
            <LabelableLabel native={false}>Country</LabelableLabel>
            <LabelableControl id="country" />
          </Teleport>
        </LabelableScope>,
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
        <LabelableScope>
          <LabelableLabel data-testid="label">Label</LabelableLabel>
          <LabelableControl data-testid="control" />
        </LabelableScope>,
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
        <LabelableScope>
          <LabelableLabel native={native} data-testid="label">
            Label
          </LabelableLabel>
        </LabelableScope>,
      );
      const label = screen.getByTestId('label');

      expect(await fireEvent[type](label, { detail: 1 })).toBe(true);
      expect(await fireEvent[type](label, { detail: 2 })).toBe(false);
    });

    it('prevents the default of a pointerdown on a label that is not native, and on no other label', async () => {
      await render(
        <LabelableScope>
          <LabelableLabel data-testid="native">Label</LabelableLabel>
          <LabelableLabel native={false} data-testid="not-native">
            Label
          </LabelableLabel>
        </LabelableScope>,
      );

      expect(await fireEvent.pointerDown(screen.getByTestId('native'))).toBe(true);
      expect(await fireEvent.pointerDown(screen.getByTestId('not-native'))).toBe(false);
    });

    describe('param: focusControl', () => {
      const FocusLabel = defineComponent(
        (props: { focusControl: (event: MouseEvent, controlId: string | undefined) => void }) => {
          const labelProps = useLabel({
            fallbackControlId: 'fallback',
            focusControl: (event, controlId) => props.focusControl(event, controlId),
          });
          return () => (
            <div data-testid="label" {...labelProps.value}>
              Label
            </div>
          );
        },
        { props: ['focusControl'] },
      );

      it.each([
        { name: 'the id of the control of the provider', withProvider: true, controlId: 'own' },
        {
          name: 'the fallback id when there is no provider',
          withProvider: false,
          controlId: 'fallback',
        },
      ])('gets the event and $name, and the control gets no focus', async (row) => {
        const focusControl = vi.fn();
        const parts = (
          <>
            <FocusLabel focusControl={focusControl} />
            <LabelableControl id={row.controlId} data-testid="control" />
          </>
        );
        const { user } = await render(
          row.withProvider ? <LabelableScope>{parts}</LabelableScope> : parts,
        );

        await user.click(screen.getByTestId('label'));

        expect(focusControl).toHaveBeenCalledTimes(1);
        const [event, controlId] = focusControl.mock.lastCall!;
        expect(event.type).toBe('click');
        expect(controlId).toBe(row.controlId);
        expect(screen.getByTestId('control')).not.toHaveFocus();
      });
    });

    describe('param: registerLabelId', () => {
      it('registers the id of the label, and removes it when the label goes away', async () => {
        const { labelId, registerLabelId } = createLabelIdRegistry();
        const Test = defineComponent(
          (props: { show: boolean }) => () =>
            props.show ? (
              <LabelableLabel registerLabelId={registerLabelId} data-testid="label" />
            ) : null,
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
              {props.first && <LabelableLabel id="first-label" registerLabelId={registerLabelId} />}
              {props.second && (
                <LabelableLabel id="second-label" registerLabelId={registerLabelId} />
              )}
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
          <LabelableLabelPosition
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
            <LabelableScope>
              <LabelableLabel id="field-label" />
              {props.ownLabel && (
                <LabelableLabel id="own-label" registerLabelId={registerLabelId} />
              )}
            </LabelableScope>
          ),
          { props: ['ownLabel'] },
        );

        const { rerender } = await render(<Test ownLabel />);
        expect(labelId.value).toBe('own-label');

        await rerender(<Test ownLabel={false} />);

        expect(labelId.value).toBeUndefined();
      });
    });
  });
});
