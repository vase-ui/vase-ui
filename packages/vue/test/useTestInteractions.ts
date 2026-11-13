import { toValue } from 'vue';
import type { MaybeRefOrGetter, VNodeRef } from 'vue';
import { ACTIVE_KEY, FOCUSABLE_ATTRIBUTE, SELECTED_KEY } from '../src/utils/popups/constants';
import type { ElementProps, InteractionProps } from '../src/utils/popups/types';

export type ExtendedUserProps = {
  [ACTIVE_KEY]?: boolean | undefined;
  [SELECTED_KEY]?: boolean | undefined;
};

export type TestElementProps = Omit<ElementProps, 'item'> & {
  item?: InteractionProps | ((props: ExtendedUserProps) => InteractionProps) | undefined;
};

type UserProps = InteractionProps & { ref?: VNodeRef | undefined };

export interface UseTestInteractionsReturn {
  getReferenceProps: (userProps?: UserProps) => Record<string, unknown>;
  getFloatingProps: (userProps?: UserProps) => Record<string, unknown>;
  getItemProps: (userProps?: UserProps & ExtendedUserProps) => Record<string, unknown>;
  getTriggerProps: (userProps?: UserProps) => Record<string, unknown>;
}

export function useTestInteractions(
  propsList: Array<MaybeRefOrGetter<TestElementProps | void>> = [],
): UseTestInteractionsReturn {
  return {
    getReferenceProps: (userProps) => mergeProps(userProps, propsList, 'reference'),
    getFloatingProps: (userProps) => mergeProps(userProps, propsList, 'floating'),
    getItemProps: (userProps) => mergeProps(userProps, propsList, 'item'),
    getTriggerProps: (userProps) => mergeProps(userProps, propsList, 'trigger'),
  };
}

function mergeProps<Key extends keyof TestElementProps>(
  userProps: (UserProps & ExtendedUserProps) | undefined,
  propsList: Array<MaybeRefOrGetter<TestElementProps | void>>,
  elementKey: Key,
): Record<string, unknown> {
  const eventHandlers = new Map<string, Array<(...args: unknown[]) => void>>();
  const isItem = elementKey === 'item';

  const outputProps = {} as Record<string, unknown>;

  if (elementKey === 'floating') {
    outputProps.tabindex = -1;
    outputProps[FOCUSABLE_ATTRIBUTE] = '';
  }

  for (const entry of propsList) {
    let props;

    const propsOrGetProps = toValue(entry)?.[elementKey];
    if (typeof propsOrGetProps === 'function') {
      props = userProps ? propsOrGetProps(userProps) : null;
    } else {
      props = propsOrGetProps;
    }
    if (!props) {
      continue;
    }

    mutablyMergeProps(outputProps, props, isItem, eventHandlers);
  }

  mutablyMergeProps(outputProps, userProps, isItem, eventHandlers);

  return outputProps;
}

function mutablyMergeProps(
  outputProps: Record<string, unknown>,
  props: any,
  isItem: boolean,
  eventHandlers: Map<string, Array<(...args: unknown[]) => void>>,
) {
  for (const key in props) {
    const value = props[key];

    if (isItem && (key === ACTIVE_KEY || key === SELECTED_KEY)) {
      continue;
    }

    if (!isEventHandlerKey(key)) {
      outputProps[key] = value;
      continue;
    }

    if (typeof value !== 'function') {
      continue;
    }

    let handlers = eventHandlers.get(key);
    if (!handlers) {
      const newHandlers: Array<(...args: unknown[]) => void> = [];
      handlers = newHandlers;
      eventHandlers.set(key, handlers);

      outputProps[key] = (...args: unknown[]) => {
        let returnValue: unknown;

        for (const fn of newHandlers) {
          const result = fn(...args);
          if (returnValue === undefined && result !== undefined) {
            returnValue = result;
          }
        }

        return returnValue;
      };
    }

    handlers.push(value);
  }
}

function isEventHandlerKey(key: string) {
  const thirdCharCode = key.charCodeAt(2);
  return (
    key.charCodeAt(0) === 111 &&
    key.charCodeAt(1) === 110 &&
    thirdCharCode >= 65 &&
    thirdCharCode <= 90
  );
}
