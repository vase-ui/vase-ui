import { h, toValue } from 'vue';
import type { Component, FunctionalComponent, MaybeRefOrGetter } from 'vue';
import { useDateTimeFieldContext } from './DateTimeFieldContext';

interface DateTimeFieldLiteralElementProps {
  tag: string | Component;
  elementProps: Record<string, any>;
  text: string;
}

/**
 * The element of a literal part, with its text as the one child. A template gives the text of a
 * dynamic element as a text node in a list of children, and Vue does not let
 * `data-allow-mismatch="text"` allow a text node of such a list. An element whose one child is a
 * string has the text content that the attribute allows. The text of a separator or of a time zone
 * name differs when the `Intl` data of the server differs.
 */
export const DateTimeFieldLiteralElement: FunctionalComponent<DateTimeFieldLiteralElementProps> = (
  props,
) =>
  typeof props.tag === 'string'
    ? h(props.tag, props.elementProps, props.text)
    : h(props.tag, props.elementProps, { default: () => props.text });

DateTimeFieldLiteralElement.props = ['tag', 'elementProps', 'text'];

/**
 * The `ref` setter of a part that shows a separator, an era or a time zone name. The root compares
 * the elements of these parts with its layout after the hydration. A literal part calls it in
 * `setup`, inside a root that called `useDateTimeFieldRoot`.
 * @param index The place of the part in the layout.
 */
export function useDateTimeFieldLiteral(
  index: MaybeRefOrGetter<number>,
): (element: unknown) => void {
  const context = useDateTimeFieldContext();
  let ownElement: HTMLElement | null = null;

  return (element) => {
    const next = element as HTMLElement | null;
    // Vue calls a function ref again on each patch, with the same element.
    if (next === ownElement) {
      return;
    }
    if (ownElement) {
      context.unregisterLiteral(ownElement);
    }
    if (next) {
      context.registerLiteral(next, toValue(index));
    }
    ownElement = next;
  };
}
