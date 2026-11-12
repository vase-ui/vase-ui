import { expect, vi, describe, it } from 'vitest';
import { mergeProps, mergePropsN } from '@vase-ui/vue/merge-props';
import type { VaseUIEvent } from './types';

describe('mergeProps', () => {
  it('merges event handlers', () => {
    const theirProps = {
      onClick: vi.fn(),
      onKeydown: vi.fn(),
    };
    const ourProps = {
      onClick: vi.fn(),
      onPaste: vi.fn(),
    };
    const mergedProps = mergeProps<'button'>(ourProps, theirProps);

    mergedProps.onClick?.(new MouseEvent('click') as any);
    mergedProps.onKeydown?.(new KeyboardEvent('keydown') as any);
    mergedProps.onPaste?.(new Event('paste') as any);

    expect(theirProps.onClick.mock.invocationCallOrder[0]).toBeLessThan(
      ourProps.onClick.mock.invocationCallOrder[0],
    );
    expect(theirProps.onClick.mock.calls.length).toBe(1);
    expect(ourProps.onClick.mock.calls.length).toBe(1);
    expect(theirProps.onKeydown.mock.calls.length).toBe(1);
    expect(ourProps.onPaste.mock.calls.length).toBe(1);
  });

  it('merges multiple event handlers', () => {
    const log: string[] = [];

    const mergedProps = mergeProps<'button'>(
      {
        onClick() {
          log.push('3');
        },
      },
      {
        onClick() {
          log.push('2');
        },
      },
      {
        onClick() {
          log.push('1');
        },
      },
    );

    mergedProps.onClick?.(new MouseEvent('click') as any);
    expect(log).toEqual(['1', '2', '3']);
  });

  it('merges undefined event handlers', () => {
    const log: string[] = [];

    const mergedProps = mergeProps<'button'>(
      {
        onClick() {
          log.push('3');
        },
      },
      {
        onClick: undefined,
      },
      {
        onClick() {
          log.push('1');
        },
      },
    );

    mergedProps.onClick?.(new MouseEvent('click') as any);
    expect(log).toEqual(['1', '3']);
  });

  it('makes a lone synthetic event handler preventable', () => {
    let prevented = false;

    const mergedProps = mergeProps<'button'>(
      {},
      {
        onMousedown(event) {
          event.preventVaseUIHandler();
          prevented = event.vaseUIHandlerPrevented === true;
        },
      },
    );

    mergedProps.onMousedown?.(new MouseEvent('mousedown') as any);

    expect(prevented).toBe(true);
  });

  it('makes a first-position synthetic event handler preventable', () => {
    let prevented = false;

    const mergedProps = mergeProps<'button'>(
      {
        onMousedown(event) {
          event.preventVaseUIHandler();
          prevented = event.vaseUIHandlerPrevented === true;
        },
      },
      {
        id: 'test-button',
      },
    );

    mergedProps.onMousedown?.(new MouseEvent('mousedown') as any);

    expect(prevented).toBe(true);
  });

  it('makes a first-position synthetic event handler preventable in mergePropsN', () => {
    let prevented = false;

    const mergedProps = mergePropsN<'button'>([
      {
        onMousedown(event) {
          event.preventVaseUIHandler();
          prevented = event.vaseUIHandlerPrevented === true;
        },
      },
      {
        id: 'test-button',
      },
    ]);

    mergedProps.onMousedown?.(new MouseEvent('mousedown') as any);

    expect(prevented).toBe(true);
  });

  it('makes a lone obscure synthetic event handler preventable', () => {
    let prevented = false;

    const mergedProps = mergeProps<'button'>(
      {},
      {
        onContextmenu(event) {
          event.preventVaseUIHandler();
          prevented = event.vaseUIHandlerPrevented === true;
        },
      },
    );

    mergedProps.onContextmenu?.(new MouseEvent('contextmenu') as any);

    expect(prevented).toBe(true);
  });

  it('merges styles', () => {
    const theirProps = {
      style: { color: 'red' },
    };
    const ourProps = {
      style: { color: 'blue', backgroundColor: 'blue' },
    };
    const mergedProps = mergeProps<'div'>(ourProps, theirProps);

    expect(mergedProps.style).toEqual({
      color: 'red',
      backgroundColor: 'blue',
    });
  });

  it('merges styles with undefined', () => {
    const theirProps = {
      style: { color: 'red' },
    };
    const ourProps = {};

    const mergedProps = mergeProps<'button'>(ourProps, theirProps);

    expect(mergedProps.style).toEqual({
      color: 'red',
    });
  });

  it('does not merge styles if both are undefined', () => {
    const theirProps = {};
    const ourProps = {};
    const mergedProps = mergeProps<'button'>(ourProps, theirProps);

    expect(mergedProps.style).toBe(undefined);
  });

  it('merges classNames with rightmost first', () => {
    const theirProps = {
      class: 'external-class',
    };
    const ourProps = {
      class: 'internal-class',
    };
    const mergedProps = mergeProps<'div'>(ourProps, theirProps);

    expect(mergedProps.class).toBe('external-class internal-class');
  });

  it('merges multiple classNames', () => {
    const mergedProps = mergeProps<'div'>(
      {
        class: 'class-1',
      },
      {
        class: 'class-2',
      },
      {
        class: 'class-3',
      },
    );

    expect(mergedProps.class).toBe('class-3 class-2 class-1');
  });

  it('merges classNames with undefined', () => {
    const theirProps = {
      class: 'external-class',
    };
    const ourProps = {};

    const mergedProps = mergeProps<'button'>(ourProps, theirProps);

    expect(mergedProps.class).toBe('external-class');
  });

  it('does not merge classNames if both are undefined', () => {
    const theirProps = {};
    const ourProps = {};
    const mergedProps = mergeProps<'button'>(ourProps, theirProps);

    expect(mergedProps.class).toBe(undefined);
  });

  it('does not prevent internal handler if event.preventBaseUIHandler() is not called', () => {
    let ran = false;

    const mergedProps = mergeProps<'button'>(
      {
        onClick() {},
      },
      {
        onClick() {
          ran = true;
        },
      },
    );

    mergedProps.onClick?.(new MouseEvent('click') as any);

    expect(ran).toBe(true);
  });

  it('prevents internal handler if event.preventBaseUIHandler() is called', () => {
    let ran = false;

    const mergedProps = mergeProps<'button'>(
      {
        onClick: function onClick3() {
          ran = true;
        },
      },
      {
        onClick: function onClick2() {
          ran = true;
        },
      },
      {
        onClick: function onClick1(event) {
          event.preventVaseUIHandler();
        },
      },
    );

    const event = new MouseEvent('click') as any;
    mergedProps.onClick?.(event);

    expect(ran).toBe(false);
  });

  it('prevents handlers merged after event.preventBaseUIHandler() is called', () => {
    const log: string[] = [];

    const mergedProps = mergeProps<any>(
      {
        onClick() {
          log.push('2');
        },
      },
      {
        onClick(event: VaseUIEvent<MouseEvent>) {
          event.preventVaseUIHandler();
          log.push('1');
        },
      },
      {
        onClick() {
          log.push('0');
        },
      },
    );

    mergedProps.onClick?.(new MouseEvent('click'));

    expect(log).toEqual(['0', '1']);
  });

  it.each([
    { name: 'a boolean', eventArgument: true },
    { name: 'a number', eventArgument: 13 },
    { name: 'a string', eventArgument: 'newValue' },
    { name: 'an object', eventArgument: { key: 'value' } },
    { name: 'an array', eventArgument: ['value'] },
    { name: 'a function', eventArgument: () => 'value' },
  ])('handles non-standard event handlers called with $name', ({ eventArgument }) => {
    const log: string[] = [];

    const mergedProps = mergeProps<any>(
      {
        onValueChange() {
          log.push('1');
        },
      },
      {
        onValueChange() {
          log.push('0');
        },
      },
    );

    mergedProps.onValueChange(eventArgument);

    expect(log).toEqual(['0', '1']);
  });

  it('forwards all arguments for a lone non-standard event handler', () => {
    const handler = vi.fn();

    const mergedProps = mergeProps<any>(
      {},
      {
        onOpenChange: handler,
      },
    );

    const eventDetails = { reason: 'test' };
    mergedProps.onOpenChange?.(true, eventDetails);

    expect(handler).toHaveBeenCalledWith(true, eventDetails);
  });

  it('forwards all arguments for merged non-standard event handlers', () => {
    const log: Array<[string, boolean, { reason: string }]> = [];
    const eventDetails = { reason: 'test' };

    const mergedProps = mergeProps<any>(
      {
        onOpenChange(open: boolean, details: { reason: string }) {
          log.push(['ours', open, details]);
        },
      },
      {
        onOpenChange(open: boolean, details: { reason: string }) {
          log.push(['theirs', open, details]);
        },
      },
    );

    mergedProps.onOpenChange?.(true, eventDetails);

    expect(log).toEqual([
      ['theirs', true, eventDetails],
      ['ours', true, eventDetails],
    ]);
  });

  it('forwards additional arguments for synthetic event handlers', () => {
    const log: Array<[string, string]> = [];

    const mergedProps = mergeProps<any>(
      {
        onMousedown(_event: VaseUIEvent<MouseEvent>, details: { reason: string }) {
          log.push(['ours', details.reason]);
        },
      },
      {
        onMousedown(_event: VaseUIEvent<MouseEvent>, details: { reason: string }) {
          log.push(['theirs', details.reason]);
        },
      },
    );

    mergedProps.onMousedown?.(new MouseEvent('mousedown') as any, {
      reason: 'pointer',
    });

    expect(log).toEqual([
      ['theirs', 'pointer'],
      ['ours', 'pointer'],
    ]);
  });

  it('merges internal props so that the ones defined first override the ones defined later', () => {
    const mergedProps = mergeProps<'button'>(
      {
        title: 'internal title 2',
      },
      {
        title: 'internal title 1',
      },
      {},
    );

    expect(mergedProps.title).toBe('internal title 1');
  });

  it('sets baseUIHandlerPrevented to true after calling preventBaseUIHandler()', () => {
    let observedFlag: boolean | undefined;

    const mergedProps = mergeProps<'button'>(
      {
        onClick() {},
      },
      {
        onClick(event) {
          event.preventVaseUIHandler();
          observedFlag = event.vaseUIHandlerPrevented;
        },
      },
    );

    mergedProps.onClick?.(new MouseEvent('click') as any);

    expect(observedFlag).toBe(true);
  });

  describe('props getters', () => {
    it('calls the props getter with the props defined after it', () => {
      let observedProps;
      const propsGetter = vi.fn((props) => {
        observedProps = { ...props };
        return props;
      });

      mergeProps(
        {
          id: '2',
          class: 'test-class',
        },
        propsGetter,
        {
          id: '1',
          role: 'button',
        },
      );

      expect(propsGetter.mock.calls.length === 1).toBe(true);
      expect(observedProps).toEqual({ id: '2', class: 'test-class' });
    });

    it('calls the props getter with merged props defined after it', () => {
      let observedProps;
      const propsGetter = vi.fn((props) => {
        observedProps = { ...props };
        return props;
      });

      mergeProps(
        {
          role: 'button',
          class: 'test-class',
        },
        {
          role: 'tab',
        },
        propsGetter,
        {
          id: 'one',
        },
      );

      expect(propsGetter.mock.calls.length === 1).toBe(true);
      expect(observedProps).toEqual({
        role: 'tab',
        class: 'test-class',
      });
    });

    it('calls the props getter with an empty object if no props are defined after it', () => {
      let observedProps;
      const propsGetter = vi.fn((props) => {
        observedProps = { ...props };
        return props;
      });

      mergeProps(propsGetter, { id: '1' });

      expect(propsGetter.mock.calls.length === 1).toBe(true);
      expect(observedProps).toEqual({});
    });

    it('does not mutate a reused object returned by the first props getter', () => {
      const shared = { class: 'base' };

      const result = mergeProps(() => shared, {
        class: 'next',
      });

      expect(result).toEqual({
        class: 'next base',
      });
      expect(shared).toEqual({
        class: 'base',
      });
    });

    it('accepts the result of the props getter', () => {
      const propsGetter = () => ({ class: 'test-class' });
      const result = mergeProps(
        {
          id: 'two',
          role: 'tab',
        },
        {
          id: 'one',
        },
        propsGetter,
      );

      expect(result).toEqual({
        class: 'test-class',
      });
    });

    it('does not automatically prevent handlers that are manually called by getter handlers', () => {
      const log: string[] = [];

      const mergedProps = mergeProps<'button'>(
        {
          onClick() {
            log.push('first-handler');
          },
        },
        (props) => ({
          onClick(event: VaseUIEvent<MouseEvent>) {
            // Call preventVaseUIHandler to signal prevention
            event.preventVaseUIHandler();
            log.push('getter-handler');
            // Manually calling the previous handler - this bypasses automatic prevention!
            props.onClick?.(new MouseEvent('click') as any);
          },
        }),
        {
          onClick() {
            // This handler does NOT call preventVaseUIHandler, so getter-handler runs
            log.push('last-handler');
          },
        },
      );

      mergedProps.onClick?.(new MouseEvent('click') as any);

      // last-handler runs first, then getter-handler (not prevented), then getter-handler
      // manually calls first-handler which runs despite preventVaseUIHandler being called
      expect(log).toEqual(['last-handler', 'getter-handler', 'first-handler']);
    });

    it('allows props getter handlers to check baseUIHandlerPrevented manually', () => {
      const log: string[] = [];

      const mergedProps = mergeProps<'button'>(
        {
          onClick() {
            log.push('first-handler');
          },
        },
        (props) => ({
          onClick(event: VaseUIEvent<MouseEvent>) {
            // Call preventVaseUIHandler to signal prevention
            event.preventVaseUIHandler();
            log.push('getter-handler');
            // Check the flag before manually calling previous handlers - this respects prevention
            if (!event.vaseUIHandlerPrevented) {
              props.onClick?.(new MouseEvent('click') as any);
            }
          },
        }),
        {
          onClick() {
            // This handler does NOT call preventVaseUIHandler, so getter-handler runs
            log.push('last-handler');
          },
        },
      );

      mergedProps.onClick?.(new MouseEvent('click') as any);

      // first-handler does NOT run because getter-handler checks the flag before calling it
      expect(log).toEqual(['last-handler', 'getter-handler']);
    });
  });
});

describe('Vue rules', () => {
  it('joins class values of different types with rightmost first', () => {
    const mergedProps = mergeProps<'div'>(
      { class: ['a', { b: true, c: false }] },
      { class: { d: true } },
    );

    expect(mergedProps.class).toBe('d a b');
  });

  it('merges style values of different types and the rightmost value wins', () => {
    const mergedProps = mergeProps<'div'>(
      { style: 'color: red; margin: 1px' },
      { style: [{ color: 'blue', padding: '2px' }, 'padding: 3px'] },
    );

    expect(mergedProps.style).toEqual({ color: 'blue', margin: '1px', padding: '3px' });
  });

  it('merges an array of handlers into one handler', () => {
    const log: string[] = [];

    const mergedProps = mergeProps<any>(
      {
        onClick() {
          log.push('part');
        },
      },
      {
        onClick: [
          () => {
            log.push('inner');
          },
          () => {
            log.push('outer');
          },
        ],
      },
    );

    expect(mergedProps.onClick).toBeTypeOf('function');
    mergedProps.onClick(new MouseEvent('click'));

    expect(log).toEqual(['inner', 'outer', 'part']);
  });

  it('treats an array of handlers as one handler for preventVaseUIHandler()', () => {
    const log: string[] = [];

    const mergedProps = mergeProps<any>(
      {
        onClick() {
          log.push('part');
        },
      },
      {
        onClick: [
          (event: VaseUIEvent<MouseEvent>) => {
            event.preventVaseUIHandler();
            log.push('first');
          },
          () => {
            log.push('second');
          },
        ],
      },
    );

    mergedProps.onClick(new MouseEvent('click'));

    expect(log).toEqual(['first', 'second']);
  });

  it.each([
    { name: 'the first set', merge: (props: object) => mergeProps<any>(props, {}) },
    { name: 'a later set', merge: (props: object) => mergeProps<any>({}, props) },
  ])('makes a lone array of handlers in $name preventable', ({ merge }) => {
    let prevented = false;

    const mergedProps = merge({
      onClick: [
        (event: VaseUIEvent<MouseEvent>) => {
          event.preventVaseUIHandler();
          prevented = event.vaseUIHandlerPrevented === true;
        },
      ],
    });

    expect(mergedProps.onClick).toBeTypeOf('function');
    mergedProps.onClick(new MouseEvent('click'));

    expect(prevented).toBe(true);
  });

  it.each([
    { name: 'null', value: null },
    { name: 'false', value: false },
  ])('keeps the handler of an earlier set when a later set has $name', ({ value }) => {
    const handler = vi.fn();

    const mergedProps = mergeProps<any>({ onClick: handler }, { onClick: value });
    mergedProps.onClick(new MouseEvent('click'));

    expect(handler).toHaveBeenCalledTimes(1);
  });

  it('prevents the handlers to the left for an event of another window', () => {
    const iframe = document.createElement('iframe');
    document.body.append(iframe);

    try {
      const OtherMouseEvent = (iframe.contentWindow as Window & typeof globalThis).MouseEvent;
      const otherWindowEvent = new OtherMouseEvent('click');
      expect(otherWindowEvent instanceof MouseEvent).toBe(false);

      const ourHandler = vi.fn();
      const mergedProps = mergeProps<any>(
        { onClick: ourHandler },
        {
          onClick(event: VaseUIEvent<MouseEvent>) {
            event.preventVaseUIHandler();
          },
        },
      );
      mergedProps.onClick(otherWindowEvent);

      expect(ourHandler).not.toHaveBeenCalled();
    } finally {
      iframe.remove();
    }
  });

  it('does not merge refs', () => {
    const ourRef = vi.fn();
    const theirRef = vi.fn();

    const mergedProps = mergeProps<'div'>({ ref: ourRef }, { ref: theirRef });

    expect(mergedProps.ref).toBe(theirRef);
    expect(ourRef).not.toHaveBeenCalled();
    expect(theirRef).not.toHaveBeenCalled();
  });
});
