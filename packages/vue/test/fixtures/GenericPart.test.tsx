import { expect, describe, it } from 'vitest';
import { createRenderer, describeConformance, flushMicrotasks } from '#test-utils';
import GenericPart from './GenericPart.vue';
import type { GenericPartChangeEventDetails } from './GenericPart.vue';

describe('<GenericPart />', () => {
  const { render } = createRenderer();

  describeConformance(<GenericPart option="a" />, () => ({
    render,
    refInstanceof: window.HTMLDivElement,
  }));

  describe('uncontrolled', () => {
    it('emits valueChange and then update:value before the click call returns, and changes the state', async () => {
      const calls: string[] = [];
      const { container } = await render(
        <GenericPart
          option="a"
          onValueChange={() => {
            calls.push('valueChange');
          }}
          {...{
            'onUpdate:value': () => {
              calls.push('update:value');
            },
          }}
        />,
      );
      const element = container.firstElementChild as HTMLElement;

      expect(element).not.toHaveAttribute('data-selected');

      element.click();

      expect(calls).toEqual(['valueChange', 'update:value']);
      await flushMicrotasks();
      expect(element).toHaveAttribute('data-selected');
    });

    it('stops update:value and the state change when valueChange cancels the change', async () => {
      const updated: string[] = [];
      const { container } = await render(
        <GenericPart
          option="a"
          onValueChange={(_value, details) => details.cancel()}
          {...{
            'onUpdate:value': (value: string) => {
              updated.push(value);
            },
          }}
        />,
      );
      const element = container.firstElementChild as HTMLElement;

      element.click();
      await flushMicrotasks();

      expect(updated).toEqual([]);
      expect(element).not.toHaveAttribute('data-selected');
    });

    it('stays uncontrolled when the value is absent', async () => {
      const { container } = await render(<GenericPart option="a" />);
      const element = container.firstElementChild as HTMLElement;

      element.click();
      await flushMicrotasks();

      expect(element).toHaveAttribute('data-selected');
    });
  });

  describe('controlled', () => {
    it('shows the new value only after the parent gives it', async () => {
      const updated: string[] = [];
      const { container, setProps } = await render(
        <GenericPart
          option="a"
          value="b"
          {...{
            'onUpdate:value': (value: string) => {
              updated.push(value);
            },
          }}
        />,
      );
      const element = container.firstElementChild as HTMLElement;

      element.click();
      await flushMicrotasks();

      expect(updated).toEqual(['a']);
      expect(element).not.toHaveAttribute('data-selected');

      await setProps({ value: 'a' });

      expect(element).toHaveAttribute('data-selected');
    });
  });

  it('gives the click event and the reason item-press in the details', async () => {
    let details: GenericPartChangeEventDetails | undefined;
    const { container } = await render(
      <GenericPart
        option="a"
        onValueChange={(_value, valueChangeDetails) => {
          details = valueChangeDetails;
        }}
      />,
    );
    const element = container.firstElementChild as HTMLElement;

    element.click();

    expect(details?.reason).toBe('item-press');
    expect(details?.event.type).toBe('click');
    expect(details?.event.target).toBe(element);
  });

  describe('listener of the consumer', () => {
    it('runs before the handler of the part', async () => {
      const calls: string[] = [];
      const { container } = await render(
        <GenericPart
          option="a"
          onClick={() => {
            calls.push('click');
          }}
          onValueChange={() => {
            calls.push('valueChange');
          }}
        />,
      );

      (container.firstElementChild as HTMLElement).click();

      expect(calls).toEqual(['click', 'valueChange']);
    });

    it('stops the change with preventVaseUIHandler', async () => {
      const calls: string[] = [];
      const { container } = await render(
        <GenericPart
          option="a"
          onClick={(event) => event.preventVaseUIHandler()}
          onValueChange={() => {
            calls.push('valueChange');
          }}
        />,
      );
      const element = container.firstElementChild as HTMLElement;

      element.click();
      await flushMicrotasks();

      expect(calls).toEqual([]);
      expect(element).not.toHaveAttribute('data-selected');
    });
  });
});
