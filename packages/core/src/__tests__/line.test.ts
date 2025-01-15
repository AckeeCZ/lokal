import Line from '../line.js';
import { describe, it, expect } from 'vitest';

describe('Line.isComment', () => {
    it('is false when not comment', () => {
        const line = new Line('pas un commentaire', 'une valeur');

        expect(line.isComment()).toEqual(false);
    });
    it('is true when comment', () => {
        const line1 = new Line('// un commentaire', null);
        const line2 = new Line('# un commentaire', null);

        expect(line1.isComment()).toEqual(true);
        expect(line2.isComment()).toEqual(true);
    });
});

describe('Line.getComment', () => {
    it('removes comment starter', () => {
        const line1 = new Line('// un commentaire', null);
        const line2 = new Line('# un commentaire   ', null);

        expect(line1.getComment()).toEqual('un commentaire');
        expect(line2.getComment()).toEqual('un commentaire');
    });
});

describe('Line.isEmpty', () => {
    it('returns true if key is missing', () => {
        const line = new Line(null, 'Translation with missing key');

        expect(line.isEmpty()).toEqual(true);
        expect(line.isComment()).toEqual(false);
    });

    it('returns true if translation is missing', () => {
        const line = new Line('missing.translation.key', null);

        expect(line.isEmpty()).toEqual(true);
        expect(line.isComment()).toEqual(false);
    });

    it('returns true if both key and translation are missing', () => {
        const line = new Line(null, null);

        expect(line.isEmpty()).toEqual(true);
        expect(line.isComment()).toEqual(false);
    });
});

describe('Line', () => {
    it('getting fields', () => {
        const line1 = new Line('key', 'value');

        expect(line1.key).toEqual('key');
        expect(line1.value).toEqual('value');
        expect(line1.isEmpty()).toEqual(false);
        expect(line1.isComment()).toEqual(false);
    });
});
