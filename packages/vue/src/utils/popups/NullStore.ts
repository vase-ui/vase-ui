import { ReactiveStore } from './ReactiveStore';
import type { SelectorFunction } from './ReactiveStore';

/**
 * A `ReactiveStore` that takes no write.
 *
 * Use it where code has no real store yet, such as a handle with no root. All apps and all server
 * requests share such code, so give the store a frozen state and a frozen context. Vue does not
 * make a frozen object reactive, so a read tracks nothing. A value inside the context, such as a
 * map, can still change.
 */
export class NullStore<
  State extends object,
  Context = Record<string, never>,
  Selectors extends Record<string, SelectorFunction<State>> = Record<string, never>,
> extends ReactiveStore<State, Context, Selectors> {
  // `update` and `set` call `setState`, so an override of `setState` alone makes them do nothing
  // today. The store stays inert even if a later change of `ReactiveStore` stops a write from going
  // through `setState`, because each method has an override.
  override setState(_newState: State) {}

  override update<const Key extends keyof State>(_changes: Pick<State, Key>) {}

  override set<Key extends keyof State>(_key: Key, _value: State[Key]) {}
}
