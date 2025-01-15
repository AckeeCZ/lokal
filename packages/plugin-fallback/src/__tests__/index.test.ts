import type { GoogleSpreadsheetRow, GoogleSpreadsheetWorksheet } from 'google-spreadsheet';
import { Line } from '@lokse/core';
import { describe, it, beforeEach, expect, vi } from 'vitest';

import fallbackPluginFactory, { type PluginOptions } from '../index.js';

export const createRow = (rowIndex: number, values: { [key: string]: any }) => {
    const defaultRow = {
        rowIndex,
        get: (key: string) => values[key],
        save: () => null,
        delete: () => null,
    };
    return new Proxy<GoogleSpreadsheetRow>({} as unknown as GoogleSpreadsheetRow, {
        get(_t: GoogleSpreadsheetRow, p: string | symbol, _r: any): any {
            const key = p as keyof GoogleSpreadsheetRow;
            if (key in defaultRow) {
                return defaultRow[key as keyof typeof defaultRow];
            }

            if (key === '_worksheet') {
                return new Proxy<GoogleSpreadsheetWorksheet>({} as unknown as GoogleSpreadsheetWorksheet, {
                    get(_t: GoogleSpreadsheetWorksheet, p: string | symbol, _r: any): any {
                        if (p === ('headerValues' satisfies keyof GoogleSpreadsheetWorksheet)) {
                            return Object.keys(values);
                        }

                        throw new Error(`GoogleSpreadsheetWorksheet::${key} not implemented`);
                    },
                });
            }

            throw new Error(`GoogleSpreadsheetRow::${key} not implemented`);
        },
    });
};

describe('Fallback plugin', () => {
    const logger = { warn: vi.fn(), log: vi.fn() };
    const factoryMeta = { languages: ['cs', 'mng'] };

    beforeEach(() => {
        logger.warn.mockReset();
    });

    it('should throw when default language not passed', () => {
        const options = { logger } as unknown as PluginOptions;

        expect(() => fallbackPluginFactory(options, factoryMeta)).toThrow(/default language must be supplied/i);
    });

    it('should throw when passed default language is not from list of languages', () => {
        const options = { logger, defaultLanguage: 'sk' };

        expect(() => fallbackPluginFactory(options, factoryMeta)).toThrow(/not available/i);
    });

    describe('readTranslation hook', () => {
        const plugin = fallbackPluginFactory({ logger, defaultLanguage: 'cs' }, factoryMeta);

        it('should keep translation as it is when filled', async () => {
            const line = new Line('test.key', 'Ukama bugama');
            const row = createRow(0, {
                key: 'test.key',
                mng: 'Ukama bugama',
                cs: 'Nejakej nesmysl',
            });
            const meta = { row, key: line.key, language: 'mng' };

            await expect(plugin.readTranslation(line, meta)).resolves.toHaveProperty('value', 'Ukama bugama');
            expect(logger.warn).not.toHaveBeenCalled();
        });

        it('should log missing fallback translation in default', async () => {
            const line = new Line('test.key', '');
            const row = createRow(0, {
                key: 'test.key',
                mng: '',
                cs: '',
            });
            const meta = { row, key: line.key, language: 'mng' };

            await expect(plugin.readTranslation(line, meta)).resolves.toHaveProperty('value', '');
            expect(logger.warn).toHaveBeenCalled();
            expect(logger.warn).toHaveBeenCalledWith(
                expect.stringMatching('Fallback translation of key "test.key" not found'),
            );
        });

        it('should not log missing fallback translation when log disabled', async () => {
            const plugin2 = fallbackPluginFactory(
                { logger, defaultLanguage: 'cs', logMissingFallback: false },
                factoryMeta,
            );
            const line = new Line('test.key', '');
            const row = createRow(0, {
                key: 'test.key',
                mng: '',
                cs: '',
            });
            const meta = { row, key: line.key, language: 'mng' };

            await expect(plugin2.readTranslation(line, meta)).resolves.toHaveProperty('value', '');
            expect(logger.warn).not.toHaveBeenCalled();
        });

        it('should fallback to default language translation when translation is empty', async () => {
            const line = new Line('test.key', '');
            const row = createRow(0, {
                key: 'test.key',
                mng: '',
                cs: 'Nejakej nesmysl',
            });
            const meta = { row, key: line.key, language: 'mng' };

            await expect(plugin.readTranslation(line, meta)).resolves.toHaveProperty('value', 'Nejakej nesmysl');
            expect(logger.warn).not.toHaveBeenCalled();
        });

        it('should fallback to default language case insensivly', async () => {
            const line = new Line('test.key', '');
            const row = createRow(0, {
                key: 'test.key',
                MNG: '',
                CS: 'Nejakej nesmysl',
            });
            const meta = { row, key: line.key, language: 'mng' };

            await expect(plugin.readTranslation(line, meta)).resolves.toHaveProperty('value', 'Nejakej nesmysl');
            expect(logger.warn).not.toHaveBeenCalled();
        });
    });
});
