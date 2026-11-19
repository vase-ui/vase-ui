import {
  computed,
  inject,
  nextTick,
  onMounted,
  onScopeDispose,
  shallowRef,
  toValue,
  watch,
} from 'vue';
import type { MaybeRefOrGetter, Ref, WatchSource } from 'vue';
import { comesBeforeInSameTree } from './comesBeforeInSameTree';
import { FieldRootContext } from './field-root-context/FieldRootContext';
import type {
  FieldControlRegistration,
  UseFieldValidationReturnValue,
} from './field-root-context/FieldRootContext';
import { NOOP } from './noop';
import { useKeepAliveState } from './useKeepAliveState';

interface ControlOptions {
  id: MaybeRefOrGetter<string | undefined>;
  name?: MaybeRefOrGetter<string | undefined>;
  value: WatchSource<unknown>;
  getValue?: (() => unknown) | undefined;
  enabled?: MaybeRefOrGetter<boolean>;
  input?: Readonly<Ref<HTMLElement | null>>;
}

export function useFieldControl(
  controlRef: FieldControlRegistration['controlRef'],
  { input, id, name, value, getValue, enabled = true }: ControlOptions,
) {
  const field = inject(FieldRootContext, null);
  const inputName = computed(() => field?.name.value ?? toValue(name));
  if (!field) {
    return { name: inputName };
  }

  const { isHeld } = useKeepAliveState();
  if (input) {
    watchFieldInput(field, input, isHeld);
  }
  const source = Symbol();
  const getId = () => toValue(id);
  const getName = () => toValue(name);
  const isEnabled = () => toValue(enabled);
  const getRegistration = () =>
    isHeld.value || !isEnabled()
      ? undefined
      : { controlRef, id: getId(), name: getName(), value: toValue(value), getValue };

  // A lazy control can add an error. Its server HTML must hydrate first.
  onMounted(() => {
    watch(
      [getId, getName, value, isEnabled],
      () => field.registerFieldControl(source, getRegistration),
      {
        immediate: true,
      },
    );
  });
  onScopeDispose(() => field.registerFieldControl(source, undefined));
  return { name: inputName };
}

function watchFieldInput(
  field: FieldRootContext,
  input: Readonly<Ref<HTMLElement | null>>,
  isHeld: Readonly<Ref<boolean>>,
) {
  const source = Symbol();
  // An ancestor can validate the other inputs in its deactivation hook.
  watch(
    [input, isHeld],
    ([node, held], [, wasHeld]) =>
      field.validation.setFieldInput(
        source,
        held ? null : (node as HTMLInputElement | null),
        wasHeld,
      ),
    { flush: 'sync' },
  );
  onScopeDispose(() => field.validation.setFieldInput(source, null));
}

export function useRegisterFieldControl(
  controlRef: FieldControlRegistration['controlRef'],
  id: ControlOptions['id'],
  value: () => unknown,
  getValue?: ControlOptions['getValue'],
  enabled: MaybeRefOrGetter<boolean> = true,
  name?: ControlOptions['name'],
): void {
  useFieldControl(controlRef, { id, name, value, getValue, enabled });
}

export function useFieldInput(): (input: HTMLElement | null) => void {
  const field = inject(FieldRootContext, null);
  if (!field) {
    return NOOP;
  }

  const input = shallowRef<HTMLElement | null>(null);
  watchFieldInput(field, input, useKeepAliveState().isHeld);
  return (node) => {
    input.value = node;
  };
}

/** Validation uses this input when `registeredInputs` is empty. */
export function createFieldInputRegistry(): Pick<
  UseFieldValidationReturnValue,
  'inputRef' | 'setFieldInput'
> {
  const inputRef = shallowRef<HTMLInputElement | null>(null);
  const inputs: { source: symbol; input: HTMLInputElement }[] = [];
  let shown: Set<HTMLInputElement> | undefined;

  function setFieldInput(source: symbol, input: HTMLInputElement | null, atShow = false) {
    const previous = inputs.findIndex((entry) => entry.source === source);
    if (previous !== -1) {
      inputs.splice(previous, 1);
    }
    if (input) {
      let index = inputs.length;
      if (atShow) {
        // Controls from one activation keep document order after the inputs from earlier activations.
        if (!shown) {
          shown = new Set();
          void nextTick(() => {
            shown = undefined;
          });
        }
        while (index > 0) {
          const before = inputs[index - 1]?.input;
          if (!before || !shown.has(before) || !comesBeforeInSameTree(input, before)) {
            break;
          }
          index -= 1;
        }
        shown.add(input);
      }
      inputs.splice(index, 0, { source, input });
    }
    inputRef.value = inputs.at(-1)?.input ?? null;
  }

  return { inputRef, setFieldInput };
}

export function useInputRegistration(
  input: Readonly<Ref<HTMLInputElement | null>>,
  register: (input: HTMLInputElement) => (() => void) | void,
) {
  const { isHeld } = useKeepAliveState();
  const registrationVersion = shallowRef(0);

  // Hydration and ancestor deactivation hooks must see the current input in the same task.
  watch(
    [input, isHeld, registrationVersion],
    ([element, held], _previous, onCleanup) => {
      if (!element || held) {
        return;
      }

      const release = register(element);
      if (release) {
        onCleanup(release);
      }
    },
    { flush: 'sync' },
  );

  return {
    isHeld,
    updateInputRegistration() {
      registrationVersion.value += 1;
    },
  };
}
