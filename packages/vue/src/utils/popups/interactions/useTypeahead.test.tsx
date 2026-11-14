import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import userEvent from '@testing-library/user-event';
import { defineComponent, KeepAlive, shallowRef } from 'vue';
import {
  createRenderer,
  fireEvent,
  flushMicrotasks,
  screen,
  useTestInteractions,
} from '#test-utils';
import { useFloating } from '../../../../test/fixtures/useFloating';
import { useClick } from './useClick';
import { useTypeahead } from './useTypeahead';
import type { UseTypeaheadProps } from './useTypeahead';

beforeEach(() => {
  vi.useFakeTimers({ shouldAdvanceTime: true });
});

afterEach(() => {
  vi.useRealTimers();
});

const { render } = createRenderer();

interface MatchSpyProps {
  onMatch?: ((index: number) => void) | undefined;
}

type ImplProps = MatchSpyProps &
  Pick<UseTypeaheadProps, 'onTyping'> & {
    list?: Array<string> | undefined;
    open?: boolean | undefined;
    onOpenChange?: ((open: boolean) => void) | undefined;
    addUseClick?: boolean | undefined;
  };

const useImpl = (props: ImplProps) => {
  const open = shallowRef(true);
  const activeIndex = shallowRef<null | number>(null);
  const { refs, context } = useFloating({
    open: () => props.open ?? open.value,
    onOpenChange(nextOpen) {
      if (props.onOpenChange) {
        props.onOpenChange(nextOpen);
      } else {
        open.value = nextOpen;
      }
    },
  });
  const listRef = shallowRef(props.list ?? ['one', 'two', 'three']);
  const typeahead = useTypeahead(context.rootStore, {
    listRef,
    activeIndex,
    onMatch(index) {
      activeIndex.value = index;
      props.onMatch?.(index);
    },
    onTyping: props.onTyping,
  });
  const click = useClick(context.rootStore, {
    enabled: () => props.addUseClick ?? false,
  });

  const { getReferenceProps, getFloatingProps } = useTestInteractions([typeahead, click]);

  return {
    activeIndex,
    open,
    getReferenceProps: (userProps?: Record<string, unknown>) =>
      getReferenceProps({
        role: 'combobox',
        ...userProps,
        ref: refs.setReference,
      }),
    getFloatingProps: () =>
      getFloatingProps({
        role: 'listbox',
        ref: refs.setFloating,
      }),
  };
};

const comboboxProps = ['onMatch', 'onTyping', 'list', 'open'] as const;

const Combobox = defineComponent(
  (
    props: MatchSpyProps &
      Pick<UseTypeaheadProps, 'onTyping'> & { list?: Array<string>; open?: boolean },
  ) => {
    const { getReferenceProps, getFloatingProps } = useImpl(props);
    return () => (
      <>
        <input {...getReferenceProps()} />
        <div {...getFloatingProps()} />
      </>
    );
  },
  { props: [...comboboxProps] },
);

const ComboboxWithElementsRef = defineComponent(
  (props: MatchSpyProps & { list?: Array<string>; hiddenIndices?: Array<number> }) => {
    const activeIndex = shallowRef<null | number>(null);
    const open = shallowRef(true);
    const { refs, context } = useFloating({
      open,
      onOpenChange(nextOpen) {
        open.value = nextOpen;
      },
    });
    const listRef = shallowRef(props.list ?? ['apple', 'apricot', 'banana']);
    const elementsRef = shallowRef<Array<HTMLElement | null>>([]);
    const typeahead = useTypeahead(context.rootStore, {
      listRef,
      elementsRef,
      activeIndex,
      onMatch(index) {
        activeIndex.value = index;
        props.onMatch?.(index);
      },
    });

    const { getReferenceProps, getFloatingProps, getItemProps } = useTestInteractions([typeahead]);

    return () => (
      <>
        <input {...getReferenceProps({ role: 'combobox', ref: refs.setReference })} />
        {open.value && (
          <div {...getFloatingProps({ role: 'listbox', ref: refs.setFloating })}>
            {listRef.value.map((value, index) => (
              <div
                key={value}
                role="option"
                aria-selected={activeIndex.value === index}
                style={props.hiddenIndices?.includes(index) ? { display: 'none' } : undefined}
                {...getItemProps({
                  ref(node) {
                    elementsRef.value[index] = node as HTMLElement | null;
                  },
                })}
              >
                {value}
              </div>
            ))}
          </div>
        )}
      </>
    );
  },
  { props: ['onMatch', 'list', 'hiddenIndices'] },
);

describe('useTypeahead', () => {
  it('passes the matching keydown event to onMatch', async () => {
    const onMatch = vi.fn();

    const App = defineComponent(() => {
      const { refs, context } = useFloating({ open: true });
      const listRef = shallowRef(['one', 'two', 'three']);
      const typeahead = useTypeahead(context.rootStore, { listRef, activeIndex: null, onMatch });
      const { getReferenceProps } = useTestInteractions([typeahead]);
      return () => <input {...getReferenceProps({ role: 'combobox', ref: refs.setReference })} />;
    });

    await render(<App />);

    await userEvent.click(screen.getByRole('combobox'));
    await userEvent.keyboard('t');

    expect(onMatch).toHaveBeenCalledTimes(1);
    expect(onMatch.mock.lastCall?.[0]).toBe(1);
    expect(onMatch.mock.lastCall?.[1].type).toBe('keydown');
    expect(onMatch.mock.lastCall?.[1].key).toBe('t');
  });

  it('rapidly focuses list items when they start with the same letter', async () => {
    const spy = vi.fn();
    await render(<Combobox onMatch={spy} />);

    await userEvent.click(screen.getByRole('combobox'));

    await userEvent.keyboard('t');
    expect(spy).toHaveBeenCalledWith(1);

    await userEvent.keyboard('t');
    expect(spy).toHaveBeenCalledWith(2);

    await userEvent.keyboard('t');
    expect(spy).toHaveBeenCalledWith(1);
  });

  it('bails out of rapid focus of first letter if the list contains a string that starts with two of the same letter', async () => {
    const spy = vi.fn();
    await render(<Combobox onMatch={spy} list={['apple', 'aaron', 'apricot']} />);

    await userEvent.click(screen.getByRole('combobox'));

    await userEvent.keyboard('a');
    expect(spy).toHaveBeenCalledWith(0);

    await userEvent.keyboard('a');
    expect(spy).toHaveBeenCalledWith(0);
  });

  it('starts from the current activeIndex and correctly loops (strict: %s)', async () => {
    const spy = vi.fn();
    await render(<Combobox onMatch={spy} list={['Toy Story 2', 'Toy Story 3', 'Toy Story 4']} />);

    await userEvent.click(screen.getByRole('combobox'));

    await userEvent.keyboard('t');
    await userEvent.keyboard('o');
    await userEvent.keyboard('y');
    expect(spy).toHaveBeenCalledWith(0);

    spy.mockReset();

    await userEvent.keyboard('t');
    await userEvent.keyboard('o');
    await userEvent.keyboard('y');
    expect(spy).not.toHaveBeenCalled();

    vi.advanceTimersByTime(750);

    await userEvent.keyboard('t');
    await userEvent.keyboard('o');
    await userEvent.keyboard('y');
    expect(spy).toHaveBeenCalledWith(1);

    vi.advanceTimersByTime(750);

    await userEvent.keyboard('t');
    await userEvent.keyboard('o');
    await userEvent.keyboard('y');
    expect(spy).toHaveBeenCalledWith(2);

    vi.advanceTimersByTime(750);

    await userEvent.keyboard('t');
    await userEvent.keyboard('o');
    await userEvent.keyboard('y');
    expect(spy).toHaveBeenCalledWith(0);
  });

  it('capslock characters continue to match', async () => {
    const spy = vi.fn();
    await render(<Combobox onMatch={spy} />);

    await userEvent.click(screen.getByRole('combobox'));

    await userEvent.keyboard('{CapsLock}t');
    expect(spy).toHaveBeenCalledWith(1);
  });

  it('does not depend on locale-sensitive lowercasing', async () => {
    const toLocaleLowerCase = String.prototype.toLocaleLowerCase;
    const toLocaleLowerCaseSpy = vi
      .spyOn(String.prototype, 'toLocaleLowerCase')
      .mockImplementation(function lowerWithTurkishLocale(this: string) {
        return toLocaleLowerCase.call(this, 'tr');
      });

    try {
      const spy = vi.fn();
      await render(<Combobox onMatch={spy} list={['Istanbul']} />);

      await userEvent.click(screen.getByRole('combobox'));

      await userEvent.keyboard('i');
      expect(spy).toHaveBeenCalledWith(0);
    } finally {
      toLocaleLowerCaseSpy.mockRestore();
    }
  });

  const App1 = defineComponent(
    (props: MatchSpyProps & { list: Array<string> }) => {
      const { getReferenceProps, getFloatingProps, activeIndex, open } = useImpl(props);
      const inputRef = shallowRef<HTMLInputElement | null>(null);

      return () => (
        <>
          <div
            {...getReferenceProps({
              onClick: () => inputRef.value?.focus(),
            })}
          >
            <input ref={inputRef} readonly />
          </div>
          {open.value && (
            <div {...getFloatingProps()}>
              {props.list.map((value, i) => (
                <div
                  key={value}
                  role="option"
                  tabindex={i === activeIndex.value ? 0 : -1}
                  aria-selected={i === activeIndex.value}
                >
                  {value}
                </div>
              ))}
            </div>
          )}
        </>
      );
    },
    { props: ['onMatch', 'list'] },
  );

  it('matches when focus is within reference', async () => {
    const spy = vi.fn();
    await render(<App1 onMatch={spy} list={['one', 'two', 'three']} />);

    await userEvent.click(screen.getByRole('combobox'));

    await userEvent.keyboard('t');
    expect(spy).toHaveBeenCalledWith(1);
  });

  it('matches when focus is within floating', async () => {
    const spy = vi.fn();
    await render(<App1 onMatch={spy} list={['one', 'two', 'three']} />);

    await userEvent.click(screen.getByRole('combobox'));

    await userEvent.keyboard('t');
    const option = await screen.findByRole('option', { selected: true });
    expect(option.textContent).toBe('two');
    option.focus();
    expect(option).toHaveFocus();

    await userEvent.keyboard('h');
    expect((await screen.findByRole('option', { selected: true })).textContent).toBe('three');
  });

  it('onTyping is called with typing activity', async () => {
    const spy = vi.fn();
    await render(<Combobox onTyping={spy} list={['one', 'two', 'three']} />);

    screen.getByRole('combobox').focus();
    await flushMicrotasks();

    await userEvent.keyboard('t');
    expect(spy).toHaveBeenCalledTimes(1);
    expect(spy).toHaveBeenCalledWith(true);

    vi.advanceTimersByTime(750);
    expect(spy).toHaveBeenCalledTimes(2);
    expect(spy).toHaveBeenCalledWith(false);
  });

  it('onTyping is called when the popup closes without moving focus', async () => {
    const spy = vi.fn();
    const { rerender } = await render(<Combobox open onTyping={spy} />);

    expect(spy).not.toHaveBeenCalled();

    screen.getByRole('combobox').focus();
    await flushMicrotasks();
    await userEvent.keyboard('t');
    expect(spy.mock.calls).toEqual([[true]]);

    await rerender(<Combobox open={false} onTyping={spy} />);
    expect(spy.mock.calls).toEqual([[true], [false]]);

    vi.advanceTimersByTime(750);
    expect(spy.mock.calls).toEqual([[true], [false]]);

    await rerender(<Combobox open onTyping={spy} />);
    expect(spy.mock.calls).toEqual([[true], [false]]);
  });

  it('skips hidden items when matching with elementsRef', async () => {
    const spy = vi.fn();
    await render(<ComboboxWithElementsRef onMatch={spy} hiddenIndices={[0]} />);

    await userEvent.click(screen.getByRole('combobox'));

    await userEvent.keyboard('a');
    expect(spy).toHaveBeenCalledWith(1);
  });

  it('does not let hidden double-letter items block rapid cycling with elementsRef', async () => {
    const spy = vi.fn();
    await render(
      <ComboboxWithElementsRef
        onMatch={spy}
        list={['aaron', 'apple', 'avocado']}
        hiddenIndices={[0]}
      />,
    );

    await userEvent.click(screen.getByRole('combobox'));

    await userEvent.keyboard('a');
    expect(spy).toHaveBeenLastCalledWith(1);

    await userEvent.keyboard('a');
    expect(spy).toHaveBeenLastCalledWith(2);
  });

  it('skips visibility:hidden items when matching with elementsRef', async () => {
    const spy = vi.fn();
    await render(<ComboboxWithElementsRef onMatch={spy} />);

    const apple = screen.getByRole('option', { name: 'apple' });

    apple.style.visibility = 'hidden';

    await userEvent.click(screen.getByRole('combobox'));

    await userEvent.keyboard('a');
    expect(spy).toHaveBeenCalledWith(1);
  });

  describe('options and the session', () => {
    const List = defineComponent(
      (props: {
        options: Omit<Partial<UseTypeaheadProps>, 'listRef'>;
        list: Array<string>;
        open?: boolean;
      }) => {
        const { refs, context } = useFloating({ open: () => props.open ?? true });
        const activeIndex = shallowRef<number | null>(null);
        const typeahead = useTypeahead(context.rootStore, {
          ...props.options,
          listRef: shallowRef(props.list),
          activeIndex,
          onMatch(index, event) {
            activeIndex.value = index;
            props.options.onMatch?.(index, event);
          },
        });
        return () => (
          <>
            <input role="combobox" ref={refs.setReference} {...typeahead.reference} />
            <div role="listbox" tabindex={-1} ref={refs.setFloating} {...typeahead.floating}>
              {props.list.map((value) => (
                <div key={value} role="option" tabindex={-1}>
                  {value}
                </div>
              ))}
            </div>
          </>
        );
      },
      { props: ['options', 'list', 'open'] },
    );

    const press = (key: string, init: KeyboardEventInit = {}) =>
      fireEvent.keyDown(screen.getByRole('combobox'), { key, ...init });

    it('lets a space key that starts no session through, and stops a space key in a session', async () => {
      const matches: number[] = [];
      await render(
        <List
          list={['new york', 'newark', 'paris']}
          options={{ onMatch: (index) => matches.push(index) }}
        />,
      );
      screen.getByRole('combobox').focus();

      expect(await press(' ')).toBe(true);
      expect(matches).toEqual([]);

      vi.advanceTimersByTime(750);
      await press('n');
      await press('e');
      await press('w');
      expect(await press(' ')).toBe(false);
      expect(matches).toEqual([0, 0, 0, 0]);

      vi.advanceTimersByTime(750);
      await press('p', { ctrlKey: true });
      expect(matches).toEqual([0, 0, 0, 0]);
    });

    it('follows a change of `enabled`, of `resetMs` and of a `disabledIndices` function', async () => {
      const enabled = shallowRef(false);
      const resetMs = shallowRef(100);
      const disabled = shallowRef<number[]>([]);
      const matches: number[] = [];
      await render(
        <List
          list={['apple', 'apricot', 'avocado']}
          options={{
            enabled,
            resetMs,
            disabledIndices: (index) => disabled.value.includes(index),
            onMatch: (index) => matches.push(index),
          }}
        />,
      );
      screen.getByRole('combobox').focus();

      await press('a');
      expect(matches).toEqual([]);

      enabled.value = true;
      await press('a');
      expect(matches).toEqual([0]);

      // The session ended after 100 ms, so `v` starts a session and matches no label.
      vi.advanceTimersByTime(100);
      await press('v');
      expect(matches).toEqual([0]);

      vi.advanceTimersByTime(100);
      disabled.value = [1];
      await press('a');
      expect(matches).toEqual([0, 2]);

      vi.advanceTimersByTime(100);
      resetMs.value = 1000;
      await press('a');
      vi.advanceTimersByTime(100);
      await press('v');
      expect(matches).toEqual([0, 2, 0, 2]);
    });

    it('keeps the session when the selected index changes while the popup is closed', async () => {
      const selectedIndex = shallowRef<number | null>(0);
      const matches: number[] = [];
      await render(
        <List
          open={false}
          list={['apple', 'banana', 'blueberry']}
          options={{
            selectedIndex,
            onMatch(index) {
              selectedIndex.value = index;
              matches.push(index);
            },
          }}
        />,
      );

      await press('b');
      await press('l');

      expect(matches).toEqual([1, 2]);
    });

    it('ends the session when the focus leaves the reference and the popup', async () => {
      const typing: boolean[] = [];
      await render(
        <>
          <List
            list={['one', 'two', 'three']}
            options={{ onTyping: (value) => typing.push(value) }}
          />
          <button>outside</button>
        </>,
      );
      screen.getByRole('combobox').focus();
      await press('t');

      screen.getByRole('listbox').focus();
      await flushMicrotasks();
      expect(typing).toEqual([true]);

      screen.getByRole('button').focus();
      await flushMicrotasks();
      expect(typing).toEqual([true, false]);
    });

    it('ends the session when `KeepAlive` deactivates the list', async () => {
      const typing: boolean[] = [];
      const page = shallowRef<'list' | 'other'>('list');
      const Other = defineComponent(() => () => <p>other</p>);
      await render(() => (
        <KeepAlive>
          {page.value === 'list' ? (
            <List
              key="list"
              list={['one', 'two', 'three']}
              options={{ onTyping: (value) => typing.push(value) }}
            />
          ) : (
            <Other key="other" />
          )}
        </KeepAlive>
      ));
      // The list does not have the focus, so no `focusout` ends the session.
      await press('t');

      page.value = 'other';
      await flushMicrotasks();
      expect(typing).toEqual([true, false]);

      vi.advanceTimersByTime(750);
      expect(typing).toEqual([true, false]);
    });
  });
});
