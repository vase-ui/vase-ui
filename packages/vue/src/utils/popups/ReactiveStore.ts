import { shallowReactive, toRaw } from 'vue';

export type SelectorFunction<State> = (state: State, ...args: any[]) => any;

type SelectorArgs<Selector> = Selector extends (state: any, ...params: infer Params) => any
  ? Params
  : never;

/**
 * Holds the state of a popup, a plain context and the selectors that read the state.
 *
 * The store makes no `computed` and no watcher, so code can make a store outside a component, with
 * no `effectScope`. A part reads a selector in a `computed` in its `setup`. That `computed` stops
 * with the part.
 */
export class ReactiveStore<
  State extends object,
  Context = Record<string, never>,
  Selectors extends Record<string, SelectorFunction<State>> = Record<string, never>,
> {
  /**
   * The state, a `shallowReactive` object. A write to a key tells the code that reads that key.
   * The state keeps each value as it is: an object, an element or a ref.
   * Write with `set`, `update` or `setState`, and not with an assignment.
   */
  readonly state: State;

  /**
   * The values that no part renders, such as a callback, a map or an event emitter.
   * The object is plain, so a write to it tells no reader.
   */
  readonly context: Context;

  private readonly selectors: Selectors | undefined;

  /**
   * The store wraps `state` and does not copy it. A frozen object stays frozen, and Vue does not
   * make it reactive.
   */
  constructor(state: State, context: Context = {} as Context, selectors?: Selectors) {
    this.state = shallowReactive(state) as State;
    this.context = context;
    this.selectors = selectors;
  }

  /**
   * Calls the selector `key` with the reactive state and the arguments.
   * A part calls it in a `computed`, so the part renders again only when the value changes.
   */
  select<Key extends keyof Selectors>(
    key: Key,
    ...args: SelectorArgs<Selectors[Key]>
  ): ReturnType<Selectors[Key]> {
    return this.selectors![key](this.state, ...args);
  }

  /**
   * Writes each key of `newState` that is different from the state, as `Object.is` compares them.
   * `update` and `set` call this method with a full state, so a subclass that overrides it sees each
   * write.
   */
  setState(newState: State): void {
    const current = toRaw(this.state);
    // A sync watcher can write the store during the loop. If the loop compared each key when it
    // wrote that key, it would write the old value of a key that the watcher changed.
    const changedKeys = (Object.keys(newState) as (keyof State)[]).filter(
      (key) => !Object.is(current[key], newState[key]),
    );
    for (const key of changedKeys) {
      this.state[key] = newState[key];
    }
  }

  /**
   * Writes some keys. Each value must match its key.
   */
  update<const Key extends keyof State>(changes: Pick<State, Key>): void {
    this.setState({ ...toRaw(this.state), ...changes });
  }

  /**
   * Writes one key.
   */
  set<Key extends keyof State>(key: Key, value: State[Key]): void {
    this.setState({ ...toRaw(this.state), [key]: value });
  }
}
