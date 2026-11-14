import * as Tooltip from '../index.parts';
import type { ComponentRenderFn, HTMLProps } from '../../internals/types';

const renderButton: ComponentRenderFn<HTMLProps, Tooltip.Trigger.State> = ({ props }) => (
  <button type="button" {...props} />
);
const renderInput: ComponentRenderFn<HTMLProps, Tooltip.Trigger.State> = ({ props }) => (
  <input {...props} />
);

<Tooltip.Trigger v-slots={{ render: renderButton }} />;
<Tooltip.Trigger v-slots={{ render: renderInput }} />;

const handle = Tooltip.createHandle<{ text: string }>();

<Tooltip.Trigger handle={handle} payload={{ text: 'a' }} />;
// @ts-expect-error - the payload must have the type of the handle
<Tooltip.Trigger handle={handle} payload={{ text: 1 }} />;
