import * as Menu from '../index.parts';

const handle = Menu.createHandle<string>();

// The trigger is generic, so its payload has the type of its handle.
<Menu.Trigger handle={handle} payload="text" />;

// @ts-expect-error - the payload of this trigger is a string
<Menu.Trigger handle={handle} payload={1} />;

// @ts-expect-error - the handle is a handle of a menu
<Menu.Trigger handle={{}} />;
