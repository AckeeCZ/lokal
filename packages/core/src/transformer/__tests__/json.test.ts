import transformer from '../json.js';
import { describe, it, expect } from 'vitest';

describe('JSONTransformer.transformKeyValue', () => {
    it('should replace new lines with empty string', () => {
        const multilineValue = `<ul>
  <li>La valeur 1</li>
</ul>`;

        const line = transformer.transformKeyValue('ma_cle', multilineValue);

        expect(line).toEqual('  "ma_cle" : "<ul>  <li>La valeur 1</li></ul>",');
    });
});
