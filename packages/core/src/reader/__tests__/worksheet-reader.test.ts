import { GoogleSpreadsheetWorksheet } from 'google-spreadsheet';
import WorksheetReader, { InvalidFilterError } from '../worksheet-reader.js';

import { describe, it, expect } from 'vitest';

const createWorksheet = (title: string, index = 1) => ({
    title,
    index,
});

describe('WorksheetReader - filter normalization', () => {
    it('normalize empty filter to all sheets filter', () => {
        const includeAllFilter = {
            include: ['*'],
            exclude: [],
        };

        const reader1 = new WorksheetReader('');
        expect(reader1.filter).toEqual(includeAllFilter);
        const reader2 = new WorksheetReader(null);
        expect(reader2.filter).toEqual(includeAllFilter);
    });

    it('normalize all filter to include all sheets filter', () => {
        const reader1 = new WorksheetReader('*');
        expect(reader1.filter).toEqual({
            include: ['*'],
            exclude: [],
        });
    });

    it('normalize string filter', () => {
        const reader1 = new WorksheetReader('laRusso');
        expect(reader1.filter).toEqual({
            include: ['laRusso'],
            exclude: [],
        });
    });

    it('normalize array filter', () => {
        const reader1 = new WorksheetReader(['a', 'b']);
        expect(reader1.filter).toEqual({
            include: ['a', 'b'],
            exclude: [],
        });
        const reader2 = new WorksheetReader(['a', 2]);
        expect(reader2.filter).toEqual({
            include: ['a', 2],
            exclude: [],
        });
    });

    it('normalize complex filter without include', () => {
        const reader1 = new WorksheetReader({ exclude: 'foo' });
        expect(reader1.filter).toEqual({
            include: ['*'],
            exclude: ['foo'],
        });
    });

    it('normalize complex filter without exclude', () => {
        const reader1 = new WorksheetReader({ include: 'bar' });
        expect(reader1.filter).toEqual({
            include: ['bar'],
            exclude: [],
        });
    });

    it('normalize complex filter without include or exclude to include all sheets filter', () => {
        const reader1 = new WorksheetReader({});
        expect(reader1.filter).toEqual({
            include: ['*'],
            exclude: [],
        });
    });

    it('throws when unsupported filter type provided', () => {
        expect(() => new WorksheetReader(true as any)).toThrow(InvalidFilterError);
        expect(() => new WorksheetReader(3 as any)).toThrow(InvalidFilterError);
        expect(() => new WorksheetReader(new Date() as any)).toThrow(InvalidFilterError);
    });
});

describe('WorksheetReader.shouldUseWorksheet', () => {
    it('should use worksheet when empty or null or asterisk', () => {
        const worksheet = createWorksheet('LeTitre') as GoogleSpreadsheetWorksheet;

        const reader1 = new WorksheetReader('');
        expect(reader1.shouldUseWorksheet(worksheet)).toEqual(true);
        const reader2 = new WorksheetReader(null);
        expect(reader2.shouldUseWorksheet(worksheet)).toEqual(true);
        const reader3 = new WorksheetReader('*');
        expect(reader3.shouldUseWorksheet(worksheet)).toEqual(true);
    });

    it('should not use worksheet when title does not match the include the filter', () => {
        const worksheet = createWorksheet('LeTitre') as GoogleSpreadsheetWorksheet;

        const reader1 = new WorksheetReader({ include: ['a', 'b'] });
        expect(reader1.shouldUseWorksheet(worksheet)).toEqual(false);
        const reader2 = new WorksheetReader({ include: ['a', 2] });
        expect(reader2.shouldUseWorksheet(worksheet)).toEqual(false);
        const reader3 = new WorksheetReader({ include: 'a' });
        expect(reader3.shouldUseWorksheet(worksheet)).toEqual(false);
    });

    it('should use worksheet when title match the include filter exactly', () => {
        const worksheet = createWorksheet('LeTitre') as GoogleSpreadsheetWorksheet;

        const reader1 = new WorksheetReader({ include: ['a', 'LeTitre'] });
        expect(reader1.shouldUseWorksheet(worksheet)).toEqual(true);
        const reader2 = new WorksheetReader({ include: ['a', 1] });
        expect(reader2.shouldUseWorksheet(worksheet)).toEqual(true);
        const reader3 = new WorksheetReader({ include: 'LeTitre' });
        expect(reader3.shouldUseWorksheet(worksheet)).toEqual(true);
    });

    it('should use worksheet when title match the include filter case insensitive', () => {
        const worksheet = createWorksheet('LeTitre') as GoogleSpreadsheetWorksheet;

        const reader1 = new WorksheetReader({ include: ['a', 'letitre'] });
        expect(reader1.shouldUseWorksheet(worksheet)).toEqual(true);
    });

    it('should not use worksheet when title match exclude filter', () => {
        const worksheet = createWorksheet('AppTrans') as GoogleSpreadsheetWorksheet;

        const reader1 = new WorksheetReader({
            exclude: 'AppTrans',
        });
        expect(reader1.shouldUseWorksheet(worksheet)).toEqual(false);
        const reader2 = new WorksheetReader({
            exclude: ['AppTrans', 'API Trans'],
        });
        expect(reader2.shouldUseWorksheet(worksheet)).toEqual(false);
    });

    it('should use worksheet when title doesnt match exclude filter and include not available', () => {
        const worksheet = createWorksheet('WebTrans') as GoogleSpreadsheetWorksheet;

        const reader1 = new WorksheetReader({
            exclude: 'AppTrans',
        });
        expect(reader1.shouldUseWorksheet(worksheet)).toEqual(true);
        const reader2 = new WorksheetReader({
            exclude: ['AppTrans', 'API Trans'],
        });
        expect(reader2.shouldUseWorksheet(worksheet)).toEqual(true);
    });

    it('should not use worksheet when title does not match include filter nor exclude filter', () => {
        const worksheet = createWorksheet('APITrans') as GoogleSpreadsheetWorksheet;

        const reader1 = new WorksheetReader({
            include: 'MyTrans',
            exclude: 'App Trans',
        });
        expect(reader1.shouldUseWorksheet(worksheet)).toEqual(false);
        const reader2 = new WorksheetReader({
            include: ['MyTrans'],
            exclude: ['App Trans'],
        });
        expect(reader2.shouldUseWorksheet(worksheet)).toEqual(false);
    });

    it.todo('should use worksheet and warn when title pass include and also exclude filter');
});
