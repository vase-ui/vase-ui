import { given } from './givenAttributes';

// @ts-expect-error `aria-labeledby` is not the name of an attribute that has a row.
given('aria-labeledby', 'label');
