import type { DateTimeFieldSegmentView } from './DateTimeFieldContext';
import type { EditableSegmentType } from './segmentLayout';

/**
 * The attributes of a segment that come from the data of `Intl` and from the numbers of the value.
 * Vue writes none of them while it hydrates, so a server that has other data leaves its own
 * attributes in the DOM. The segment binds these attributes, and the root compares them with the
 * DOM after the hydration.
 */
export function getSegmentAttributes(
  type: EditableSegmentType,
  view: DateTimeFieldSegmentView,
): Record<string, string | number | undefined> {
  return {
    inputmode: type === 'dayPeriod' ? 'text' : 'numeric',
    size: view.size,
    placeholder: view.placeholder,
    'aria-label': view.label,
    'aria-valuenow': view.number,
    'aria-valuemin': view.min,
    'aria-valuemax': view.max,
    'aria-valuetext': view.valueText,
  };
}
