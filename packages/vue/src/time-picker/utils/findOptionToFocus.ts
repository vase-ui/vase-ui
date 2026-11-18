import { toValue } from 'vue';
import { isElementDisabled } from '../../common/isElementDisabled';
import type { CompositeMetadata } from '../../internals/composite/list/useCompositeList';

/** The selected enabled option, or the first enabled option in index order. */
export function findOptionToFocus(
  options: ReadonlyMap<Element, CompositeMetadata<unknown>>,
): Element | undefined {
  let firstEnabled: Element | undefined;
  for (const [option, { itemState }] of options) {
    if (
      !option.isConnected ||
      toValue(itemState?.disabled) ||
      isElementDisabled(option) ||
      option.matches(':disabled')
    ) {
      continue;
    }
    if (toValue(itemState?.selected)) {
      return option;
    }
    firstEnabled ??= option;
  }
  return firstEnabled;
}
