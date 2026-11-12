import { createLogOnce } from './createLogOnce';

export const warn = createLogOnce('warn', 'Vase UI');

export { reset } from './createLogOnce';
