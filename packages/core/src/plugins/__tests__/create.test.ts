import identity from 'lodash/identity.js';

import { createPlugin } from '../create.js';
import { describe, it, expect } from 'vitest';

describe('createPlugin', () => {
    it('should fulfill missing plugin hooks', () => {
        const plugin = createPlugin({
            transformFullOutput: (arg: string) => arg,
        });

        expect(plugin.transformLine).toEqual(identity);
        expect(plugin.transformFullOutput).not.toEqual(identity);
    });
});
