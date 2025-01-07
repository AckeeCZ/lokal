import { EOL } from 'os';
import mkdirp from 'mkdirp';

import { type Mock, vi, describe } from 'vitest';

const fs = {
    access: vi.fn(),
    readFile: vi.fn().mockResolvedValue(''),
    writeFile: vi.fn(),
};

vi.mock('fs/promises', () => fs);
vi.mock('mkdirp', () => ({
    default: vi.fn(),
}));

import Line from '../line';
import { transformersByFormat } from '../transformer';
import { OutputFormat } from '../constants';
import { PluginsRunner } from '../plugins';

const androidTransformer = transformersByFormat[OutputFormat.ANDROID];
const iosTransformer = transformersByFormat[OutputFormat.IOS];
const jsonTransformer = transformersByFormat[OutputFormat.JSON];

const logger = { warn: vi.fn(), log: vi.fn() };
const plugin = {
    pluginName: 'test',
    transformFullOutput: vi.fn(),
    transformLine: vi.fn(),
    readTranslation: vi.fn(),
};
const plugins = new PluginsRunner([plugin], { logger });

describe('Writer', async () => {
    const FileWriter = await import('../writer').then(v => v.default);
    beforeEach(() => {
        plugin.transformFullOutput.mockReset().mockImplementation(output => output);
        plugin.transformLine.mockReset().mockImplementation(line => line);

        fs.access.mockClear();
        fs.readFile.mockClear();
        fs.writeFile.mockClear();
        (mkdirp as unknown as Mock).mockResolvedValue(null);
    });

    describe('.write', () => {
        it('use transformer to compose output and write it', async () => {
            const writer = new FileWriter(plugins);
            await writer.write(
                { language: 'cz', outputDir: '/' },
                [new Line('key', 'value'), new Line('key2', 'value2')],
                jsonTransformer,
            );

            expect(fs.writeFile).toHaveBeenCalledTimes(1);
            expect(fs.writeFile).toHaveBeenCalledWith(
                '/cz.json',
                EOL + '{' + EOL + '  "key" : "value",' + EOL + '  "key2" : "value2"' + EOL + '}',
                'utf8',
            );
        });

        it('process output with hook', async () => {
            plugin.transformFullOutput.mockImplementation((output: string) => {
                return JSON.stringify(JSON.parse(output), null, 0);
            });
            const writer = new FileWriter(plugins);
            await writer.write(
                { language: 'cz', outputDir: '/' },
                [new Line('key', 'value'), new Line('key2', 'value2')],
                jsonTransformer,
            );

            expect(fs.writeFile).toHaveBeenCalledTimes(1);
            expect(fs.writeFile).toHaveBeenCalledWith('/cz.json', '{"key":"value","key2":"value2"}', 'utf8');
        });
    });

    describe('.getTransformedLines', () => {
        it('process line with hook', async () => {
            plugin.transformLine.mockImplementation((line: Line) => {
                /* eslint-disable max-nested-callbacks */
                line.setKey(key => key.toUpperCase());
                line.setValue(value => value + ' extended');
                /* eslint-enable max-nested-callbacks */
                return line;
            });

            const writer = new FileWriter(plugins);
            const result = await writer.getTransformedLines(
                [new Line('key', 'value'), new Line('key2', 'value2')],
                androidTransformer,
                { language: '' },
            );

            expect(result).toEqual(
                '    <string name="KEY">value extended</string>' +
                    EOL +
                    '    <string name="KEY2">value2 extended</string>',
            );
        });

        it('with android transformer should return xml', async () => {
            const writer = new FileWriter(plugins);
            const result = await writer.getTransformedLines(
                [new Line('key', 'value'), new Line('// commentaire', null), new Line('key2', 'value2')],
                androidTransformer,
                { language: '' },
            );

            expect(result).toEqual(
                '    <string name="key">value</string>' +
                    EOL +
                    '    <!-- commentaire -->' +
                    EOL +
                    '    <string name="key2">value2</string>',
            );
        });

        it('with ios transformer should return in format', async () => {
            const writer = new FileWriter(plugins);
            const result = await writer.getTransformedLines(
                [new Line('key', 'value'), new Line('# commentaire', null), new Line('key2', 'value2')],
                iosTransformer,
                { language: '' },
            );

            expect(result).toEqual('"key" = "value";' + EOL + '// commentaire' + EOL + '"key2" = "value2";');
        });
    });
});
