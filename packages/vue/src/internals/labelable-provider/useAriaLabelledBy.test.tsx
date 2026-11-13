import { expect, describe, it, onTestFinished, vi } from 'vitest';
import { KeepAlive, Teleport, defineComponent, shallowRef } from 'vue';
import {
  createRenderer,
  flushMicrotasks,
  hydrate,
  renderOnServer,
  screen,
  within,
} from '#test-utils';
import HiddenInputControl from '../../../test/fixtures/HiddenInputControl.vue';
import LabelableLabel from '../../../test/fixtures/LabelableLabel.vue';
import LabelableScope from '../../../test/fixtures/LabelableScope.vue';
import UseAriaLabelledByHydration from './UseAriaLabelledByHydration.test.vue';

interface LabelState {
  for?: string | undefined;
  id?: string | undefined;
}

describe('useAriaLabelledBy', () => {
  const { render } = createRenderer();

  describe('at mount', () => {
    it('names the control with a label around it', async () => {
      await render(
        <label data-testid="label">
          <HiddenInputControl data-testid="control" />
        </label>,
      );

      const label = screen.getByTestId('label');
      expect(label.id).not.toBe('');
      expect(screen.getByTestId('control')).toHaveAttribute('aria-labelledby', label.id);
    });

    it.each<{
      name: string;
      labelProps?: { id: string };
      controlProps?: { ariaLabel?: string; ariaLabelledby?: string; enableFallback?: boolean };
      labelledBy: string | null;
      labelId: string | null;
    }>([
      {
        name: 'gives a label with no `id` the id of the control plus `-label`',
        labelledBy: 'a-label',
        labelId: 'a-label',
      },
      {
        name: 'keeps the `id` of the label',
        labelProps: { id: 'own' },
        labelledBy: 'own',
        labelId: 'own',
      },
      {
        name: 'prefers the `aria-labelledby` of the consumer',
        controlProps: { ariaLabelledby: 'explicit' },
        labelledBy: 'explicit',
        labelId: null,
      },
      {
        name: 'keeps a blank `aria-labelledby` of the consumer',
        controlProps: { ariaLabelledby: '' },
        labelledBy: '',
        labelId: 'a-label',
      },
      {
        name: 'gives no `aria-labelledby` when the control has an `aria-label`',
        controlProps: { ariaLabel: 'Name' },
        labelledBy: null,
        labelId: null,
      },
      {
        name: 'keeps the label when the `aria-label` is empty',
        controlProps: { ariaLabel: '' },
        labelledBy: 'a-label',
        labelId: 'a-label',
      },
      {
        name: 'keeps the label when the `aria-label` is a space',
        controlProps: { ariaLabel: ' ' },
        labelledBy: 'a-label',
        labelId: 'a-label',
      },
      {
        name: 'keeps the label when the `aria-label` has tabs, line breaks and spaces',
        controlProps: { ariaLabel: '\n\t ' },
        labelledBy: 'a-label',
        labelId: 'a-label',
      },
      {
        name: 'gives no `aria-labelledby` when `enableFallback` is `false`',
        controlProps: { enableFallback: false },
        labelledBy: null,
        labelId: null,
      },
    ])('$name', async ({ labelProps, controlProps, labelledBy, labelId }) => {
      await render(
        <>
          <label for="a" data-testid="label" {...labelProps}>
            Name
          </label>
          <HiddenInputControl id="a" data-testid="control" {...controlProps} />
        </>,
      );

      expect(screen.getByTestId('control').getAttribute('aria-labelledby')).toBe(labelledBy);
      expect(screen.getByTestId('label').getAttribute('id')).toBe(labelId);
    });

    it('prefers the label of the provider, and gives a native label around both no `id`', async () => {
      await render(
        <label data-testid="native">
          <LabelableScope>
            <LabelableLabel native={false} data-testid="label">
              Name
            </LabelableLabel>
            <HiddenInputControl data-testid="control" />
          </LabelableScope>
        </label>,
      );

      const label = screen.getByTestId('label');
      expect(label.id).not.toBe('');
      expect(screen.getByTestId('control')).toHaveAttribute('aria-labelledby', label.id);
      expect(screen.getByTestId('native')).not.toHaveAttribute('id');
    });
  });

  async function renderControlWithTwoLabels() {
    const id = shallowRef('a');
    const Test = defineComponent(() => () => (
      <>
        <label for="a">Name A</label>
        <label for="b">Name B</label>
        <HiddenInputControl id={id.value} data-testid="control" />
      </>
    ));
    await render(<Test />);
    const control = screen.getByTestId('control');
    expect(control).toHaveAttribute('aria-labelledby', 'a-label');
    return { control, id };
  }

  it('VUE-16: follows a change of the id of the control', async () => {
    const { control, id } = await renderControlWithTwoLabels();

    id.value = 'b';
    await flushMicrotasks();

    expect(control).toHaveAttribute('aria-labelledby', 'b-label');
  });

  describe('the native label of the control', () => {
    const ODD_ID = 'a"] b\\c:d';

    it.each([
      {
        name: 'a label that is not its parent',
        scene: () => (
          <label id="outer">
            <div>
              <HiddenInputControl data-testid="control" />
            </div>
          </label>
        ),
        labelledBy: 'outer',
      },
      {
        name: 'the first label in tree order',
        scene: () => (
          <>
            <label id="with-for" for="a">
              Name
            </label>
            <label id="outer">
              <div>
                <HiddenInputControl id="a" data-testid="control" />
              </div>
            </label>
          </>
        ),
        labelledBy: 'with-for',
      },
      {
        name: 'a label around it before one with for',
        scene: () => (
          <>
            <label id="outer">
              <div>
                <HiddenInputControl id="a" data-testid="control" />
              </div>
            </label>
            <label id="with-for" for="a">
              Name
            </label>
          </>
        ),
        labelledBy: 'outer',
      },
      {
        name: 'no label of an earlier element',
        scene: () => (
          <>
            <label id="with-for" for="a">
              Name
            </label>
            <input id="a" />
            <HiddenInputControl id="a" data-testid="control" />
          </>
        ),
        labelledBy: null,
      },
      {
        name: 'a label for an id with odd characters',
        scene: () => (
          <>
            <label id="with-for" for={ODD_ID}>
              Name
            </label>
            <div />
            <HiddenInputControl id={ODD_ID} data-testid="control" />
          </>
        ),
        labelledBy: 'with-for',
      },
    ])('names the control with $name', async ({ scene, labelledBy }) => {
      await render(scene());

      expect(screen.getByTestId('control').getAttribute('aria-labelledby')).toBe(labelledBy);
    });
  });

  it('removes `aria-labelledby` when an `aria-label` is added, and gives it back when the `aria-label` is removed', async () => {
    const ariaLabel = shallowRef<string | undefined>();
    const Test = defineComponent(() => () => (
      <>
        <label for="a">Name</label>
        <HiddenInputControl id="a" ariaLabel={ariaLabel.value} data-testid="control" />
      </>
    ));
    await render(<Test />);
    const control = screen.getByTestId('control');
    expect(control).toHaveAttribute('aria-labelledby', 'a-label');

    ariaLabel.value = 'Name';
    await flushMicrotasks();

    expect(control).not.toHaveAttribute('aria-labelledby');

    ariaLabel.value = undefined;
    await flushMicrotasks();

    expect(control).toHaveAttribute('aria-labelledby', 'a-label');
  });

  describe('when the control does not update', () => {
    // The props of the control stay the same, so Vue does not render the control again when the
    // parent renders. Only the observer sees the change of the label.
    it.each<{
      name: string;
      initial: LabelState | null;
      next: LabelState | null;
      before: string | null;
      after: string | null;
    }>([
      {
        name: 'names the control with a `<label for>` that appears',
        initial: null,
        next: { for: 'a' },
        before: null,
        after: 'a-label',
      },
      {
        name: 'removes the name when the `<label for>` goes away',
        initial: { for: 'a' },
        next: null,
        before: 'a-label',
        after: null,
      },
      {
        name: 'removes the name when the `for` of the label changes to another id',
        initial: { for: 'a' },
        next: { for: 'other' },
        before: 'a-label',
        after: null,
      },
      {
        name: 'follows a change of the `id` of the label',
        initial: { for: 'a', id: 'own' },
        next: { for: 'a', id: 'other' },
        before: 'own',
        after: 'other',
      },
    ])('$name', async ({ initial, next, before, after }) => {
      const label = shallowRef(initial);
      const Test = defineComponent(() => () => (
        <>
          {label.value && (
            <label for={label.value.for} id={label.value.id}>
              Name
            </label>
          )}
          <HiddenInputControl id="a" data-testid="control" />
        </>
      ));
      await render(<Test />);
      const control = screen.getByTestId('control');
      expect(control.getAttribute('aria-labelledby')).toBe(before);

      label.value = next;
      await flushMicrotasks();

      expect(control.getAttribute('aria-labelledby')).toBe(after);
    });

    it('names the control with a label that appears in the shadow root of the control', async () => {
      const host = document.createElement('div');
      const container = document.createElement('div');
      host.attachShadow({ mode: 'open' }).append(container);
      document.body.append(host);
      onTestFinished(() => host.remove());
      const showLabel = shallowRef(false);
      const Test = defineComponent(() => () => (
        <Teleport to={container}>
          {showLabel.value && <label for="a">Name</label>}
          <HiddenInputControl id="a" data-testid="control" />
        </Teleport>
      ));
      await render(<Test />);
      const control = within(container).getByTestId('control');
      expect(control).not.toHaveAttribute('aria-labelledby');

      showLabel.value = true;
      await flushMicrotasks();

      expect(control).toHaveAttribute('aria-labelledby', 'a-label');
    });
  });

  describe('under `KeepAlive`', () => {
    // `KeepAlive` keeps the input in a detached element while the control is hidden. A lookup there
    // would observe that element, and not the document of the active control.
    it('names the control with a label that comes while the control is hidden, and follows that label after the control is shown', async () => {
      const shown = shallowRef(true);
      const controlId = shallowRef('a');
      const showLabel = shallowRef(false);
      const Control = defineComponent(() => () => (
        <HiddenInputControl id={controlId.value} data-testid="control" />
      ));
      const Test = defineComponent(() => () => (
        <>
          {showLabel.value && <label for="b">Name</label>}
          <KeepAlive>{shown.value ? <Control /> : null}</KeepAlive>
        </>
      ));
      await render(<Test />);
      shown.value = false;
      await flushMicrotasks();
      showLabel.value = true;
      controlId.value = 'b';
      await flushMicrotasks();

      shown.value = true;
      await flushMicrotasks();

      const control = screen.getByTestId('control');
      expect(control).toHaveAttribute('aria-labelledby', 'b-label');

      showLabel.value = false;
      await flushMicrotasks();

      expect(control).not.toHaveAttribute('aria-labelledby');
    });
  });

  describe('observer', () => {
    it('shares one observer between the controls of a root node, and disconnects it with the last control', async () => {
      const observe = vi.spyOn(MutationObserver.prototype, 'observe');
      const disconnect = vi.spyOn(MutationObserver.prototype, 'disconnect');
      const showFirst = shallowRef(true);
      const showSecond = shallowRef(true);
      const Test = defineComponent(() => () => (
        <>
          {showFirst.value && <HiddenInputControl id="a" />}
          {showSecond.value && <HiddenInputControl id="b" />}
        </>
      ));

      try {
        await render(<Test />);

        const labelObservers = observe.mock.calls
          .map(([, options], index) => ({ options, observer: observe.mock.contexts[index] }))
          .filter(({ options }) => options?.attributeFilter?.includes('for'))
          .map(({ observer }) => observer);
        const disconnected = () =>
          disconnect.mock.contexts.filter((observer) => labelObservers.includes(observer)).length;
        expect(labelObservers).toHaveLength(1);
        expect(disconnected()).toBe(0);

        showFirst.value = false;
        await flushMicrotasks();

        expect(disconnected()).toBe(0);

        showSecond.value = false;
        await flushMicrotasks();

        expect(disconnected()).toBe(1);
      } finally {
        observe.mockRestore();
        disconnect.mockRestore();
      }
    });
  });

  describe('server HTML and hydration', () => {
    const FILE = 'src/internals/labelable-provider/UseAriaLabelledByHydration.test.vue';

    // A `<template>` element parses the HTML with no side effect.
    function parse(html: string) {
      const template = document.createElement('template');
      template.innerHTML = html;
      return template.content;
    }

    function expectLabelledBy(root: ParentNode, expected: 'label' | 'none') {
      const label = root.querySelector('[data-testid="label"]');
      const labelledBy = root
        .querySelector('[data-testid="control"]')
        ?.getAttribute('aria-labelledby');
      if (expected === 'none') {
        expect(labelledBy).toBeNull();
      } else {
        expect(label?.id).toBeTruthy();
        expect(labelledBy).toBe(label?.id);
      }
    }

    it.each<{
      name: string;
      props: { label: 'native' | 'provider'; ariaLabel?: string };
      server: 'label' | 'none';
      hydrated: 'label' | 'none';
    }>([
      {
        name: 'names the control with a label around it after the page hydrates',
        props: { label: 'native' },
        server: 'none',
        hydrated: 'label',
      },
      {
        name: 'names the control with the label of the provider in the server HTML',
        props: { label: 'provider' },
        server: 'label',
        hydrated: 'label',
      },
      {
        name: 'gives no `aria-labelledby` for a control that has an `aria-label`',
        props: { label: 'provider', ariaLabel: 'Name' },
        server: 'none',
        hydrated: 'none',
      },
    ])('$name', async ({ props, server, hydrated }) => {
      const serverHtml = await renderOnServer(FILE, props);

      const serverRoot = parse(serverHtml);
      expectLabelledBy(serverRoot, server);
      if (props.label === 'native') {
        // The DOM matchers need an element of a document with a window, and a template has none.
        expect(serverRoot.querySelector('[data-testid="label"]')?.getAttribute('id')).toBeNull();
      }

      const { container } = await hydrate(UseAriaLabelledByHydration, { serverHtml, props });

      expectLabelledBy(container, hydrated);
    });
  });
});
