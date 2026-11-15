import { h } from 'vue';
import type { Component, FunctionalComponent } from 'vue';

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
