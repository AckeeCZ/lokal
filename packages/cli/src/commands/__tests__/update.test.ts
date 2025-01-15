import dedent from 'dedent';
import { describe, Mock, vi, expect, MockedClass, beforeEach, afterEach, it, MockedFunction } from 'vitest';
import { runCommand } from './utils.js';
import { when } from 'vitest-when';
import {
    FileWriter,
    InvalidFilterError,
    OutputFormat,
    transformersByFormat,
    Reader,
    WorksheetReader,
    getConfig,
    type Line,
    type WorksheetLinesByTitle,
} from '@lokse/core';

import { noExitCliInvariant } from '../../invariants.js';
import type { CosmiconfigResult } from 'cosmiconfig';
/*
const mockOraInstance = {
    start: vi.fn(),
    warn: vi.fn(),
    succeed: vi.fn(),
    fail: vi.fn(),
};
vi.mock('ora', () => vi.fn().mockReturnValue(mockOraInstance)); */

vi.mock('@lokse/core');
// TODO fix mocking of getConfig
const getConfigMock = getConfig as MockedFunction<typeof getConfig>;
const outputFormats = Object.values(OutputFormat).join(', ');
const jsonTransformer = transformersByFormat[OutputFormat.JSON];

const ReaderMock = Reader as MockedClass<typeof Reader>;
const WorksheetReaderMock = WorksheetReader as MockedClass<typeof WorksheetReader>;
const FileWriterMock = FileWriter as MockedClass<typeof FileWriter>;
const mockRead = ReaderMock.prototype.read;
const mockWrite = FileWriterMock.prototype.write;

/**
 * Mocking error output with https://www.npmjs.com/package/fancy-test#stdoutstderr-mocking
 * doesn't work as vi somehow wraps error output by itself. Therefore we need to mock
 * console.error and check what was send into it
 */
const consoleErrorBackup = console.error;
const fakeSpreadsheetId = 'fake-spreadsheet-id';
const keyColumn = 'web';
const translationsDir = 'src/translations';
const languages = ['cs', 'en-us', 'en-gb'];
const params = {
    id: `--id=${fakeSpreadsheetId}`,
    dir: `--dir=${translationsDir}`,
    col: `--col=${keyColumn}`,
    langs: `--languages=${languages.join(',')}`,
    format: `--format=json`,
} as const;

const mockSheetLines = [{ key: 'sheet1.line' }, { key: 'sheet1.line' }] as Line[];
const mockSheetLines2 = [{ key: 'sheet2.line_1' }, { key: 'sheet2.line_2' }] as Line[];
const mockSheetLines3 = [{ key: 'sheet3.line_1' }, { key: 'sheet3.line_2' }] as Line[];

describe('update command', async () => {
    beforeEach(() => {
        ReaderMock.mockClear();
        WorksheetReaderMock.mockClear();
        mockRead.mockClear().mockReturnValue(Promise.resolve(mockSheetLines as unknown as WorksheetLinesByTitle));
        FileWriterMock.mockClear();
        mockWrite
            .mockClear()
            .mockImplementation(async ({ language, domain }) => [language, domain].filter(Boolean).join('.'));

        // mockOraInstance.start.mockClear();
        // mockOraInstance.warn.mockClear();
        // mockOraInstance.succeed.mockClear();
        // mockOraInstance.fail.mockClear();

        getConfigMock.mockReset();
        console.error = vi.fn();
    });
    afterEach(() => {
        console.error = consoleErrorBackup;
    });

    it('throws when id not provided', async () => {
        await expect(runCommand(['update', params.col, params.langs, params.dir])).rejects.toThrow(
            `💥 Sheet id is required for update of translations`,
        );
    });

    it('throws when output directory not provided', async () => {
        await expect(runCommand(['update', params.id, params.col, params.langs])).rejects.toThrow(
            `💥 Output directory is required for update of translations`,
        );
    });

    it('throws when keys column not provided', async () => {
        await expect(runCommand(['update', params.id, params.dir, params.langs])).rejects.toThrow(
            `💥 Keys column is required for update of translations`,
        );
    });

    it('throws when languages list not provided', async () => {
        await expect(runCommand(['update', params.id, params.dir, params.col])).rejects.toThrow(
            `🤷‍♂️ Translation columns have to be list of languages, but undefined given`,
        );
    });

    it('throws when languages list is not an array', async () => {
        getConfigMock.mockResolvedValueOnce({
            languages: 'cs,en',
        } as any);
        await expect(runCommand(['update', params.id, params.dir, params.col])).rejects.toThrow(
            `🤷‍♂️ Translation columns have to be list of languages, but cs,en given`,
        );
    });

    it('throws when unknown format provided', async () => {
        await expect(runCommand(['update', '--format=unknown_format'])).rejects.toThrow(
            `Expected --format=unknown_format to be one of: ${outputFormats}`,
        );
    });
    it('set empty filter when no one supplied', async () => {
        WorksheetReaderMock.mockImplementation(function (...args) {
            console.log('new reader mock', args);
            return vi.fn()(...args);
        });
        await runCommand(['update', ...Object.values(params)]);

        expect(ReaderMock.mock.instances).toHaveLength(1);
        const instance = ReaderMock.mock.instances[0] as any;
        expect(instance[1]).toBeUndefined();
    });

    describe('Sheets filter', () => {
        it('uses filter when only one name supplied', async () => {
            await runCommand(['update', ...Object.values(params), '--sheets="Main translations"']);
            expect(WorksheetReaderMock.mock.instances).toHaveLength(1);
            expect(WorksheetReaderMock.mock.calls[0][0]).toEqual(['Main translations']);
            expect(ReaderMock).toHaveBeenCalled();
        });

        it('parses and uses filter when list of names supplied', async () => {
            await runCommand(['update', ...Object.values(params), '--sheets=Main translations,Secondary translations']);

            expect(WorksheetReaderMock.mock.instances).toHaveLength(1);
            expect(WorksheetReaderMock.mock.calls[0][0]).toEqual(['Main translations', 'Secondary translations']);
            expect(ReaderMock).toHaveBeenCalled();
        });

        it('throws when filter has invalid format', async () => {
            getConfigMock.mockResolvedValue({ sheets: true } as any);

            WorksheetReaderMock.mockImplementationOnce(() => {
                throw new InvalidFilterError(true);
            });

            await expect(runCommand(['update', ...Object.values(params)])).rejects.toThrow();

            expect(WorksheetReaderMock).toHaveBeenCalled();
            expect(WorksheetReaderMock.mock.calls[0][0]).toEqual(true);
            expect(ReaderMock).not.toHaveBeenCalled();
        });

        it('uses string filter supplied through config', async () => {
            getConfigMock.mockReturnValue({
                config: { sheets: 'Secondary translations' },
            } satisfies Partial<CosmiconfigResult> as any);
            await runCommand(['update', ...Object.values(params)]);

            expect(WorksheetReaderMock.mock.instances).toHaveLength(1);
            expect(WorksheetReaderMock.mock.calls[0][0]).toEqual('Secondary translations');
            expect(ReaderMock).toHaveBeenCalled();
        });

        it('uses names list filter supplied through config', async () => {
            getConfigMock.mockReturnValue({
                config: { sheets: ['Main translations', 'Secondary translations'] },
            } satisfies Partial<CosmiconfigResult> as any);

            await runCommand(['update', ...Object.values(params)]);

            expect(WorksheetReaderMock.mock.instances).toHaveLength(1);
            expect(WorksheetReaderMock.mock.calls[0][0]).toEqual(['Main translations', 'Secondary translations']);
            expect(ReaderMock).toHaveBeenCalled();
        });

        it('uses include only filter supplied through config', async () => {
            getConfigMock.mockReturnValue({
                config: {
                    sheets: {
                        include: ['Main translations', 'Other translations'],
                    },
                },
            } satisfies Partial<CosmiconfigResult> as any);

            await runCommand(['update', ...Object.values(params)]);

            expect(WorksheetReaderMock.mock.instances).toHaveLength(1);
            expect(WorksheetReaderMock.mock.calls[0][0]).toEqual({
                include: ['Main translations', 'Other translations'],
            });
            expect(ReaderMock).toHaveBeenCalled();
        });

        it('uses exclude only filter supplied through config', async () => {
            getConfigMock.mockReturnValue({
                config: {
                    sheets: {
                        exclude: ['Main translations', 'Other translations'],
                    },
                },
            } satisfies Partial<CosmiconfigResult> as any);
            await runCommand(['update', ...Object.values(params)]);

            expect(WorksheetReaderMock.mock.instances).toHaveLength(1);
            expect(WorksheetReaderMock.mock.calls[0][0]).toEqual({
                exclude: ['Main translations', 'Other translations'],
            });
        });
        it('uses mixed include and exclude filter supplied through config', async () => {
            getConfigMock.mockReturnValue({
                config: {
                    sheets: {
                        include: 'Main translations',
                        exclude: ['Other translations', 'Non web translations'],
                    },
                },
            } satisfies Partial<CosmiconfigResult> as any);
            await runCommand(['update', ...Object.values(params)]);

            expect(WorksheetReaderMock.mock.instances).toHaveLength(1);
            expect(WorksheetReaderMock.mock.calls[0][0]).toEqual({
                include: 'Main translations',
                exclude: ['Other translations', 'Non web translations'],
            });
        });

        it('reads data for each language', async () => {
            await runCommand(['update', ...Object.values(params)]);

            expect(ReaderMock.mock.instances).toHaveLength(1);
            expect(ReaderMock.mock.calls[0][0]).toEqual(fakeSpreadsheetId);

            expect(mockRead).toHaveBeenCalledTimes(3);
            expect(mockRead).toHaveBeenNthCalledWith(1, keyColumn, languages[0]);
            expect(mockRead).toHaveBeenNthCalledWith(2, keyColumn, languages[1]);
            expect(mockRead).toHaveBeenNthCalledWith(3, keyColumn, languages[2]);
        });

        it('doesnt write language data when lines set is empty', async () => {
            mockRead.mockReturnValue(Promise.resolve({}));
            await runCommand(['update', ...Object.values(params)]);

            expect(mockWrite).not.toHaveBeenCalled();

            expect(mockOraInstance.warn).toHaveBeenCalledTimes(3);
            expect(mockOraInstance.warn).toHaveBeenNthCalledWith(
                1,
                `Received empty lines set for language ${languages[0]}`,
            );
            expect(mockOraInstance.warn).toHaveBeenNthCalledWith(
                2,
                `Received empty lines set for language ${languages[1]}`,
            );
            expect(mockOraInstance.warn).toHaveBeenNthCalledWith(
                3,
                `Received empty lines set for language ${languages[2]}`,
            );
        });

        it('writes language data in desired format into the output dir', async () => {
            mockRead.mockReturnValue(Promise.resolve({ sheet1: mockSheetLines }));
            // TODO stub(process, 'cwd', vi.fn().mockReturnValue('/ROOT_PKG_PATH'))
            await runCommand(['update', ...Object.values(params)]);

            expect(mockWrite).toHaveBeenCalledTimes(3);
            expect(mockOraInstance.succeed).toHaveBeenCalledTimes(3);

            expect(mockWrite.mock.calls[0][0]).toEqual({
                language: languages[0],
                domain: undefined,
                outputDir: `/ROOT_PKG_PATH/${translationsDir}`,
            });
            expect(mockWrite.mock.calls[0][1]).toEqual(mockSheetLines);
            expect(mockOraInstance.succeed).toHaveBeenNthCalledWith(
                1,
                `All ${languages[0]} translations saved into ${translationsDir}/${languages[0]}`,
            );

            expect(mockWrite.mock.calls[1][0]).toEqual({
                language: languages[1],
                domain: undefined,
                outputDir: `/ROOT_PKG_PATH/${translationsDir}`,
            });
            expect(mockWrite.mock.calls[1][1]).toEqual(mockSheetLines);
            expect(mockOraInstance.succeed).toHaveBeenNthCalledWith(
                2,
                `All ${languages[1]} translations saved into ${translationsDir}/${languages[1]}`,
            );

            expect(mockWrite.mock.calls[2][0]).toEqual({
                language: languages[2],
                domain: undefined,
                outputDir: `/ROOT_PKG_PATH/${translationsDir}`,
            });
            expect(mockOraInstance.succeed).toHaveBeenNthCalledWith(
                3,
                `All ${languages[2]} translations saved into ${translationsDir}/${languages[2]}`,
            );
        });

        it('print error when process of reading or writing fails', async () => {
            mockRead
                .mockImplementationOnce(async () => ({ sheet1: mockSheetLines }))
                .mockImplementationOnce(() => {
                    throw new Error('Read spreadsheet error');
                });

            await expect(runCommand(['update', ...Object.values(params)])).rejects.toThrow('Read spreadsheet error');

            expect(mockRead).toHaveBeenCalledTimes(2);
            expect(mockWrite).toHaveBeenCalledTimes(1);

            expect(mockOraInstance.fail).toHaveBeenCalledTimes(1);
            expect(mockOraInstance.fail).toHaveBeenCalledWith(`Generating ${languages[1]} translations failed.`);

            expect(mockOraInstance.succeed).toHaveBeenCalledTimes(1);
            expect(mockOraInstance.succeed).toHaveBeenCalledWith(
                `All ${languages[0]} translations saved into ${translationsDir}/${languages[0]}`,
            );
        });

        it('goes through other langs when non critical error occur during read or write', async () => {
            mockRead
                .mockImplementationOnce((_, lang) => {
                    return noExitCliInvariant(false, `No exit read ${lang} error`) as never;
                })
                .mockImplementation(async () => mockSheetLines as unknown as WorksheetLinesByTitle);
            mockWrite.mockImplementationOnce(() => {
                return noExitCliInvariant(false, 'No exit write translations error') as never;
            });

            await runCommand(['update', ...Object.values(params)]);
            expect(mockRead).toHaveBeenCalledTimes(3);
            expect(mockWrite).toHaveBeenCalledTimes(2);

            expect(mockOraInstance.fail).toHaveBeenCalledTimes(2);
            expect(mockOraInstance.fail).toHaveBeenNthCalledWith(1, `Generating ${languages[0]} translations failed.`);
            expect(mockOraInstance.fail).toHaveBeenNthCalledWith(2, `Generating ${languages[1]} translations failed.`);

            expect(mockOraInstance.succeed).toHaveBeenCalledTimes(1);
            expect(mockOraInstance.succeed).toHaveBeenCalledWith(
                `All ${languages[2]} translations saved into ${translationsDir}/${languages[2]}`,
            );

            expect(console.error).toHaveBeenCalledTimes(2);
            expect((console.error as Mock).mock.calls[0][0]).toContain('No exit read cs error');
            expect((console.error as Mock).mock.calls[1][0]).toContain('No exit write translations error');
        });
    });

    describe('Splitting translations', () => {
        const langsParam = `--languages=${languages[0]},${languages[1]}`;
        const threeSheets = {
            'sheet1 Title': mockSheetLines,
            'sheet2 Title': mockSheetLines2,
            'sheet3 Title': mockSheetLines3,
        };

        // test.it('fail when splitTranslations isnt boolean nor array of strings');

        it('doesnt split when option enabled but output transformer doesnt support it', async () => {
            mockRead.mockReturnValue(Promise.resolve(threeSheets));
            getConfigMock.mockReturnValue({
                config: { splitTranslations: true },
            } satisfies Partial<CosmiconfigResult> as any);
            mockWrite
                .mockReturnValueOnce(Promise.resolve(`/values-${languages[0]}strings.xml`))
                .mockReturnValueOnce(Promise.resolve(`/values-${languages[1]}strings.xml`));

            // TODO stub(process, 'cwd', vi.fn().mockReturnValue('/ROOT_PKG_PATH'))
            await runCommand(['update', ...Object.values(params), langsParam, `--format=android`]);

            let relPath = '';

            expect(mockWrite).toHaveBeenCalledTimes(2);
            expect(mockOraInstance.succeed).toHaveBeenCalledTimes(2);

            const writeCalls = mockWrite.mock.calls;

            relPath = `${translationsDir}/values-${languages[0]}strings.xml`;
            expect(writeCalls[0][0]).toEqual({
                language: languages[0],
                domain: undefined,
                outputDir: `/ROOT_PKG_PATH/${translationsDir}`,
            });
            expect(writeCalls[0][1]).toEqual([...mockSheetLines, ...mockSheetLines2, ...mockSheetLines3]);

            expect(mockOraInstance.succeed).toHaveBeenNthCalledWith(
                1,
                `All ${languages[0]} translations saved into ${relPath}`,
            );

            relPath = `${translationsDir}/values-${languages[1]}strings.xml`;
            expect(writeCalls[1][0]).toEqual({
                language: languages[1],
                domain: undefined,
                outputDir: `/ROOT_PKG_PATH/${translationsDir}`,
            });
            expect(writeCalls[1][1]).toEqual([...mockSheetLines, ...mockSheetLines2, ...mockSheetLines3]);

            expect(mockOraInstance.succeed).toHaveBeenNthCalledWith(
                2,
                `All ${languages[1]} translations saved into ${relPath}`,
            );
        });

        it('splits by sheet title when split option is true', async () => {
            // TODO stub(process, 'cwd', vi.fn().mockReturnValue('/ROOT_PKG_PATH'))

            mockRead.mockReturnValue(Promise.resolve(threeSheets));
            getConfigMock.mockReturnValue({
                config: { splitTranslations: true },
            } satisfies Partial<CosmiconfigResult> as any);

            await runCommand(['update', ...Object.values(params), langsParam]);

            expect(mockWrite).toHaveBeenCalledTimes(6);
            expect(mockOraInstance.succeed).toHaveBeenCalledTimes(2);

            const writeCalls = mockWrite.mock.calls;

            expect(writeCalls[0][0]).toEqual({
                language: languages[0],
                domain: 'sheet1-title',
                outputDir: `/ROOT_PKG_PATH/${translationsDir}`,
            });
            expect(writeCalls[0][1]).toEqual(mockSheetLines);
            expect(writeCalls[1][0]).toEqual({
                language: languages[0],
                domain: 'sheet2-title',
                outputDir: `/ROOT_PKG_PATH/${translationsDir}`,
            });
            expect(writeCalls[1][1]).toEqual(mockSheetLines2);
            expect(writeCalls[2][0]).toEqual({
                language: languages[0],
                domain: 'sheet3-title',
                outputDir: `/ROOT_PKG_PATH/${translationsDir}`,
            });
            expect(writeCalls[2][1]).toEqual(mockSheetLines3);

            expect(mockOraInstance.succeed).toHaveBeenNthCalledWith(
                1,
                dedent`All ${languages[0]} translations saved into ${translationsDir}
                Splitted to sheet1-title, sheet2-title, sheet3-title`,
            );

            expect(writeCalls[3][0]).toEqual({
                language: languages[1],
                domain: 'sheet1-title',
                outputDir: `/ROOT_PKG_PATH/${translationsDir}`,
            });
            expect(writeCalls[3][1]).toEqual(mockSheetLines);
            expect(writeCalls[4][0]).toEqual({
                language: languages[1],
                domain: 'sheet2-title',
                outputDir: `/ROOT_PKG_PATH/${translationsDir}`,
            });
            expect(writeCalls[4][1]).toEqual(mockSheetLines2);
            expect(writeCalls[5][0]).toEqual({
                language: languages[1],
                domain: 'sheet3-title',
                outputDir: `/ROOT_PKG_PATH/${translationsDir}`,
            });
            expect(writeCalls[5][1]).toEqual(mockSheetLines3);

            expect(mockOraInstance.succeed).toHaveBeenNthCalledWith(
                2,
                dedent`All ${languages[1]} translations saved into ${translationsDir}
                Splitted to sheet1-title, sheet2-title, sheet3-title`,
            );
        });

        it('warns if there is only one sheet so splitting is unnecessary', async () => {
            mockRead.mockReturnValue(Promise.resolve({ 'Sheet 1': mockSheetLines }));
            getConfigMock.mockReturnValue({
                config: { splitTranslations: true },
            } satisfies Partial<CosmiconfigResult> as any);

            // TODO .stub(process, 'cwd', vi.fn().mockReturnValue('/ROOT_PKG_PATH'))
            await runCommand(['update', ...Object.values(params), langsParam]);

            expect(mockWrite).toHaveBeenCalledTimes(2);
            expect(mockOraInstance.succeed).toHaveBeenCalledTimes(2);

            const writeCalls = mockWrite.mock.calls;

            expect(writeCalls[0][0]).toEqual({
                language: languages[0],
                domain: 'sheet-1',
                outputDir: `/ROOT_PKG_PATH/${translationsDir}`,
            });
            expect(writeCalls[0][1]).toEqual(mockSheetLines);

            expect(writeCalls[1][0]).toEqual({
                language: languages[1],
                domain: 'sheet-1',
                outputDir: `/ROOT_PKG_PATH/${translationsDir}`,
            });
            expect(writeCalls[1][1]).toEqual(mockSheetLines);

            expect(console.error).toHaveBeenCalledTimes(2);
            expect((console.error as Mock).mock.calls[0][0]).toContain(`Requested splitting translations by sheet but`);
        });

        it('split translations by specified domains and put rest into the general', async () => {
            mockRead.mockReturnValue(Promise.resolve(threeSheets));
            getConfigMock.mockReturnValue({
                config: { splitTranslations: ['sheet1', 'sheet3'] },
            } satisfies Partial<CosmiconfigResult> as any);

            // TODO .stub(process, 'cwd', vi.fn().mockReturnValue('/ROOT_PKG_PATH'))
            await runCommand(['update', ...Object.values(params), langsParam]);

            expect(mockWrite).toHaveBeenCalledTimes(6);
            expect(mockOraInstance.succeed).toHaveBeenCalledTimes(2);

            expect(mockWrite).toHaveBeenCalledWith(
                {
                    outputDir: `/ROOT_PKG_PATH/${translationsDir}`,
                    language: languages[0],
                    domain: 'sheet1',
                },
                mockSheetLines,
                expect.anything(),
            );
            expect(mockWrite).toHaveBeenCalledWith(
                {
                    outputDir: `/ROOT_PKG_PATH/${translationsDir}`,
                    language: languages[0],
                    domain: undefined,
                },
                mockSheetLines2,
                expect.anything(),
            );
            expect(mockWrite).toHaveBeenCalledWith(
                {
                    outputDir: `/ROOT_PKG_PATH/${translationsDir}`,
                    language: languages[0],
                    domain: 'sheet3',
                },
                mockSheetLines3,
                expect.anything(),
            );

            expect(mockOraInstance.succeed).toHaveBeenNthCalledWith(
                1,
                dedent`All ${languages[0]} translations saved into ${translationsDir}
                  Splitted to sheet1, sheet3, other`,
            );

            expect(mockWrite).toHaveBeenCalledWith(
                {
                    outputDir: `/ROOT_PKG_PATH/${translationsDir}`,
                    language: languages[1],
                    domain: 'sheet1',
                },
                mockSheetLines,
                expect.anything(),
            );
            expect(mockWrite).toHaveBeenCalledWith(
                {
                    outputDir: `/ROOT_PKG_PATH/${translationsDir}`,
                    language: languages[1],
                    domain: undefined,
                },
                mockSheetLines2,
                expect.anything(),
            );
            expect(mockWrite).toHaveBeenCalledWith(
                {
                    outputDir: `/ROOT_PKG_PATH/${translationsDir}`,
                    language: languages[1],
                    domain: 'sheet3',
                },
                mockSheetLines3,
                expect.anything(),
            );
            expect(mockOraInstance.succeed).toHaveBeenNthCalledWith(
                2,
                dedent`All ${languages[1]} translations saved into ${translationsDir}
                  Splitted to sheet1, sheet3, other`,
            );
        });

        it('write other domain translations if writing one of them fail', async () => {
            // TODO stub(process, 'cwd', vi.fn().mockReturnValue('/ROOT_PKG_PATH'))

            mockRead.mockReturnValue(Promise.resolve(threeSheets));

            when(mockWrite)
                .calledWith(
                    {
                        language: languages[0],
                        domain: 'sheet2-title',
                        outputDir: `/ROOT_PKG_PATH/${translationsDir}`,
                    },
                    mockSheetLines2,
                    jsonTransformer,
                )
                .thenReject(new Error(`Write error`));
            when(mockWrite)
                .calledWith(
                    {
                        language: languages[1],
                        domain: 'sheet1-title',
                        outputDir: `/ROOT_PKG_PATH/${translationsDir}`,
                    },
                    mockSheetLines,
                    jsonTransformer,
                )
                .thenReject(new Error(`Write error 2`));

            getConfigMock.mockReturnValue({
                config: { splitTranslations: true },
            } satisfies Partial<CosmiconfigResult> as any);

            await runCommand(['update', ...Object.values(params), langsParam]);

            expect(mockWrite).toHaveBeenCalledTimes(6);
            expect(mockOraInstance.warn).toHaveBeenCalledTimes(2);

            expect(mockWrite).toHaveBeenCalledWith(
                {
                    outputDir: `/ROOT_PKG_PATH/${translationsDir}`,
                    language: languages[0],
                    domain: 'sheet1-title',
                },
                mockSheetLines,
                expect.anything(),
            );
            expect(mockWrite).toHaveBeenCalledWith(
                {
                    outputDir: `/ROOT_PKG_PATH/${translationsDir}`,
                    language: languages[0],
                    domain: 'sheet2-title',
                },
                mockSheetLines2,
                expect.anything(),
            );
            expect(mockWrite).toHaveBeenCalledWith(
                {
                    outputDir: `/ROOT_PKG_PATH/${translationsDir}`,
                    language: languages[0],
                    domain: 'sheet3-title',
                },
                mockSheetLines3,
                expect.anything(),
            );

            expect(mockOraInstance.warn).toHaveBeenNthCalledWith(
                1,
                `Some of ${languages[0]} splitted translations were not saved`,
            );

            expect(mockWrite).toHaveBeenCalledWith(
                {
                    outputDir: `/ROOT_PKG_PATH/${translationsDir}`,
                    language: languages[1],
                    domain: 'sheet1-title',
                },
                mockSheetLines,
                expect.anything(),
            );
            expect(mockWrite).toHaveBeenCalledWith(
                {
                    outputDir: `/ROOT_PKG_PATH/${translationsDir}`,
                    language: languages[1],
                    domain: 'sheet2-title',
                },
                mockSheetLines2,
                expect.anything(),
            );
            expect(mockWrite).toHaveBeenCalledWith(
                {
                    outputDir: `/ROOT_PKG_PATH/${translationsDir}`,
                    language: languages[1],
                    domain: 'sheet3-title',
                },
                mockSheetLines3,
                expect.anything(),
            );

            expect(mockOraInstance.warn).toHaveBeenNthCalledWith(
                2,
                `Some of ${languages[1]} splitted translations were not saved`,
            );
        });

        it('should not create the other group when every translation belongs to any named group', async () => {
            mockRead.mockReturnValue(
                Promise.resolve({
                    'sheet1 Title': mockSheetLines,
                    'sheet2 Title': mockSheetLines2,
                }),
            );
            getConfigMock.mockReturnValue({
                config: { splitTranslations: ['sheet1', 'sheet2'] },
            } satisfies Partial<CosmiconfigResult> as any);

            // TODO .stub(process, 'cwd', vi.fn().mockReturnValue('/ROOT_PKG_PATH'))
            await runCommand(['update', ...Object.values(params), langsParam]);

            expect(mockWrite).toHaveBeenCalledTimes(4);
            expect(mockOraInstance.succeed).toHaveBeenCalledTimes(2);

            expect(mockWrite).toHaveBeenCalledWith(
                {
                    outputDir: `/ROOT_PKG_PATH/${translationsDir}`,
                    language: languages[0],
                    domain: 'sheet1',
                },
                mockSheetLines,
                expect.anything(),
            );
            expect(mockWrite).toHaveBeenCalledWith(
                {
                    outputDir: `/ROOT_PKG_PATH/${translationsDir}`,
                    language: languages[0],
                    domain: 'sheet2',
                },
                mockSheetLines2,
                expect.anything(),
            );

            expect(mockOraInstance.succeed).toHaveBeenNthCalledWith(
                1,
                dedent`All ${languages[0]} translations saved into ${translationsDir}
                  Splitted to sheet1, sheet2`,
            );

            expect(mockWrite).toHaveBeenCalledWith(
                {
                    outputDir: `/ROOT_PKG_PATH/${translationsDir}`,
                    language: languages[1],
                    domain: 'sheet1',
                },
                mockSheetLines,
                expect.anything(),
            );
            expect(mockWrite).toHaveBeenCalledWith(
                {
                    outputDir: `/ROOT_PKG_PATH/${translationsDir}`,
                    language: languages[1],
                    domain: 'sheet2',
                },
                mockSheetLines2,
                expect.anything(),
            );

            expect(mockOraInstance.succeed).toHaveBeenNthCalledWith(
                2,
                dedent`All ${languages[1]} translations saved into ${translationsDir}
                  Splitted to sheet1, sheet2`,
            );
        });

        it('should split correctly when domain contains dot', async () => {
            mockRead.mockReturnValue(
                Promise.resolve({
                    'sheet1 Title': [{ key: 'sheet.1.line' }, { key: 'sheet.1.line' }],
                    'sheet2 Title': [{ key: 'sheet.2.line' }, { key: 'sheet.2.line' }],
                } as unknown as WorksheetLinesByTitle),
            );
            getConfigMock.mockReturnValue({
                config: { splitTranslations: ['sheet.1', 'sheet.2'] },
            } satisfies Partial<CosmiconfigResult> as any);

            // TODO .stub(process, 'cwd', vi.fn().mockReturnValue('/ROOT_PKG_PATH'))
            await runCommand(['update', ...Object.values(params), `--languages=${languages[0]}`]);

            expect(mockWrite).toHaveBeenCalledTimes(2);
            expect(mockOraInstance.succeed).toHaveBeenCalledTimes(1);

            expect(mockWrite).toHaveBeenCalledWith(
                {
                    outputDir: `/ROOT_PKG_PATH/${translationsDir}`,
                    language: languages[0],
                    domain: 'sheet.1',
                },
                [{ key: 'sheet.1.line' }, { key: 'sheet.1.line' }],
                expect.anything(),
            );
            expect(mockWrite).toHaveBeenCalledWith(
                {
                    outputDir: `/ROOT_PKG_PATH/${translationsDir}`,
                    language: languages[0],
                    domain: 'sheet.2',
                },
                [{ key: 'sheet.2.line' }, { key: 'sheet.2.line' }],
                expect.anything(),
            );

            expect(mockOraInstance.succeed).toHaveBeenNthCalledWith(
                1,
                dedent`All ${languages[0]} translations saved into ${translationsDir}
                  Splitted to sheet.1, sheet.2`,
            );
        });

        it('should split correctly when domain name is part of other domain', async () => {
            mockRead.mockReturnValue(
                Promise.resolve({
                    'sheet1 Title': [
                        { key: 'sheet1.line' },
                        { key: 'sheet1.line' },
                        { key: 'sheet12.line' },
                        { key: 'sheet12.line' },
                    ],
                } as unknown as WorksheetLinesByTitle),
            );
            getConfigMock.mockReturnValue({
                config: { splitTranslations: ['sheet1', 'sheet12'] },
            } satisfies Partial<CosmiconfigResult> as any);

            vi.spyOn(process, 'cwd').mockReturnValueOnce('/ROOT_PKG_PATH');
            await runCommand(['update', ...Object.values(params), `--languages=${languages[0]}`]);

            expect(mockWrite).toHaveBeenCalledTimes(2);
            expect(mockOraInstance.succeed).toHaveBeenCalledTimes(1);

            expect(mockWrite).toHaveBeenCalledWith(
                {
                    outputDir: `/ROOT_PKG_PATH/${translationsDir}`,
                    language: languages[0],
                    domain: 'sheet1',
                },
                [{ key: 'sheet1.line' }, { key: 'sheet1.line' }],
                expect.anything(),
            );
            expect(mockWrite).toHaveBeenCalledWith(
                {
                    outputDir: `/ROOT_PKG_PATH/${translationsDir}`,
                    language: languages[0],
                    domain: 'sheet12',
                },
                [{ key: 'sheet12.line' }, { key: 'sheet12.line' }],
                expect.anything(),
            );

            expect(mockOraInstance.succeed).toHaveBeenNthCalledWith(
                1,
                dedent`All ${languages[0]} translations saved into ${translationsDir}
                  Splitted to sheet1, sheet12`,
            );
        });

        // TODO - warn if there is sheets filter turned
        // on and so not all sheets are included in processing
    });
});
