import { GoogleSpreadsheet } from 'google-spreadsheet';
import SpreadsheetReader from '../spreadsheet-reader';
import WorksheetReader from '../worksheet-reader';
import { LangColumnNotFound, KeyColumnNotFound } from '../../errors';
import Line from '../../line';
import Worksheet from '../worksheet';
import { PluginsRunner } from '../../plugins';
import { vi, expect, describe, beforeEach, it, Mock } from 'vitest';

const GoogleSpreadsheetMock = GoogleSpreadsheet as unknown as Mock;

vi.mock('google-spreadsheet');

const makeFakeLine = (id: string) => {
    return { id: `line_${id}` } as unknown as Line;
};

const makeFakeWorksheet = (title: string, lines: Line[]) => {
    const fakeWorksheet = {
        title,
        extractLines: vi.fn().mockReturnValue(lines),
    };
    return fakeWorksheet as unknown as Worksheet;
};

describe('SpreadsheetReader', () => {
    const testLogger = {
        log: vi.fn(),
        warn: vi.fn(),
    };
    const noPlugins = new PluginsRunner([], { logger: testLogger });

    describe('authenticate', () => {
        beforeEach(() => {
            GoogleSpreadsheetMock.mockClear();
        });

        it('throw if service account nor api key found', async () => {
            return;
            const reader = new SpreadsheetReader('test-sheet-id', new WorksheetReader('*'), noPlugins);

            await expect(reader.authenticate()).rejects.toHaveProperty(
                'message',
                'Could not load the default credentials. Browse to https://cloud.google.com/docs/authentication/getting-started for more information.',
            );
        });
    });

    describe('read', () => {
        const linesSet1 = [makeFakeLine('1_1'), makeFakeLine('1_2')];

        const linesSet2 = [makeFakeLine('2_1'), makeFakeLine('2_2'), makeFakeLine('2_3')];

        const linesSet3 = [makeFakeLine('3_1')];

        beforeEach(() => {
            testLogger.warn.mockReset();
        });

        it('should return map of lines by sheet title', async () => {
            expect.assertions(1);

            const sheetsList = [
                makeFakeWorksheet('fakeSheet1', linesSet1),
                makeFakeWorksheet('fakeSheet2', linesSet2),
                makeFakeWorksheet('fakeSheet3', linesSet3),
            ];

            const reader = new SpreadsheetReader('test-sheet-id', new WorksheetReader('*'), noPlugins, {
                logger: testLogger,
            });
            vi.spyOn(reader, 'fetchSheets').mockResolvedValue(sheetsList);

            await expect(reader.read('key', 'en-gb')).resolves.toEqual({
                fakeSheet1: linesSet1,
                fakeSheet2: linesSet2,
                fakeSheet3: linesSet3,
            });
        });

        it('should omit sheet in map lines when extracting fail from any reason', async () => {
            expect.assertions(4);

            const sheetsList = [
                makeFakeWorksheet('fakeSheet1', linesSet1),
                makeFakeWorksheet('fakeSheet2', linesSet2),
                makeFakeWorksheet('fakeSheet3', linesSet2),
                makeFakeWorksheet('fakeSheet4', linesSet3),
            ];

            const mockLangColError = new LangColumnNotFound('en-gb', sheetsList[1].title);
            (sheetsList[1].extractLines as Mock).mockImplementationOnce(() => {
                throw mockLangColError;
            });

            const mockKeyColError = new KeyColumnNotFound('key', sheetsList[2].title);
            (sheetsList[2].extractLines as Mock).mockImplementationOnce(() => {
                throw mockKeyColError;
            });

            const reader = new SpreadsheetReader('test-sheet-id', new WorksheetReader('*'), noPlugins, {
                logger: testLogger,
            });
            vi.spyOn(reader, 'fetchSheets').mockResolvedValue(sheetsList);

            await expect(reader.read('key', 'en-gb')).resolves.toEqual({
                fakeSheet1: linesSet1,
                fakeSheet4: linesSet3,
            });
            expect(testLogger.warn).toHaveBeenCalledTimes(2);
            expect(testLogger.warn).toHaveBeenNthCalledWith(1, expect.stringContaining(mockLangColError.message));
            expect(testLogger.warn).toHaveBeenNthCalledWith(2, expect.stringContaining(mockKeyColError.message));
        });

        it('should concat sheets with same title', async () => {
            expect.assertions(3);

            const sheetsList = [
                makeFakeWorksheet('fakeSheet1', linesSet1),
                makeFakeWorksheet('fakeSheet2', linesSet2),
                makeFakeWorksheet('fakeSheet1', linesSet3),
            ];

            const reader = new SpreadsheetReader('test-sheet-id', new WorksheetReader('*'), noPlugins, {
                logger: testLogger,
            });
            vi.spyOn(reader, 'fetchSheets').mockResolvedValue(sheetsList);

            await expect(reader.read('key', 'en-gb')).resolves.toEqual({
                fakeSheet1: [...linesSet1, ...linesSet3],
                fakeSheet2: linesSet2,
            });
            expect(testLogger.warn).toHaveBeenCalledTimes(1);
            expect(testLogger.warn).toHaveBeenCalledWith(
                expect.stringContaining(`🔀 Found two sheets with same title fakeSheet1`),
            );
        });
    });
});
