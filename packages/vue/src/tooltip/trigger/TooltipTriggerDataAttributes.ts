import { CommonTriggerDataAttributes } from '../../utils/popups/popupStateMapping';

/**
 * Present when a fieldset disables the native button.
 */
export const disabled = 'data-disabled';
/**
 * Present when the corresponding tooltip is open.
 */
export const popupOpen = CommonTriggerDataAttributes.popupOpen;
/**
 * Present when the `disabled` prop, a parent `<Tooltip.Root>`, or a fieldset around the native
 * button disables the tooltip.
 */
export const triggerDisabled = 'data-trigger-disabled';
