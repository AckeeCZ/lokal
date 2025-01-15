import { EOL } from 'os';
import * as path from 'path';
import mkdirp from 'mkdirp';
import * as fs from 'fs/promises';

import Transformer from './transformer/index.js';
import Line from './line.js';
import { PluginsRunner } from './plugins/index.js';
import type { TransformLineMeta } from './plugins/index.js';

interface FileInfo {
    language: string;
    domain?: string;
    outputDir: string;
}
class FileWriter {
    // eslint-disable-next-line no-useless-constructor
    constructor(private plugins: PluginsRunner) {}

    async write(
        fileInfo: FileInfo,
        lines: Line[],
        transformer: Transformer,
        encoding: BufferEncoding = 'utf8',
    ): Promise<string> {
        let fileContent = '';
        const { language, domain, outputDir } = fileInfo;
        const fileName = transformer.getFileName(language, domain);
        const filePath = path.resolve(outputDir, fileName);

        try {
            await fs.access(filePath, fs.constants.F_OK);
            console.debug(fs.access);
            fileContent = await fs.readFile(filePath, encoding);

            fileContent = fileContent.toString();
        } catch {
            // file doesnt exist yet
        }

        const valueToInsert = await this.getTransformedLines(lines, transformer, {
            language,
            domain,
        });

        let output = await transformer.insert(fileContent, valueToInsert);
        output = await this.plugins.runHook('transformFullOutput', output, {
            transformer,
            language,
            domain,
        });

        const dirname = path.dirname(filePath);
        await mkdirp(dirname);
        await fs.writeFile(filePath, output, encoding);

        return fileName;
    }

    async getTransformedLines(lines: Line[], transformer: Transformer, meta: TransformLineMeta): Promise<string> {
        let valueToInsert = '';

        const plurals: { [pluralKey: string]: Line[] } = {};

        for (let i = 0; i < lines.length; i++) {
            const unprocessedLine = lines[i];
            const isLastLine = i === lines.length - 1;

            if (unprocessedLine.isEmpty()) {
                continue;
            }

            // eslint-disable-next-line no-await-in-loop
            const line = await this.plugins.runHook('transformLine', unprocessedLine, meta);

            if (line.isComment()) {
                valueToInsert += transformer.transformComment(line.getComment());
            } else if (line.isPlural()) {
                if (!plurals[line.key]) {
                    plurals[line.key] = [];
                }

                plurals[line.key].push(line);
            } else {
                valueToInsert += transformer.transformKeyValue(line.key, line.value);
            }

            if (!line.isPlural() && (!isLastLine || Object.keys(plurals).length > 0)) {
                valueToInsert += EOL;
            }
        }

        valueToInsert += Object.entries(plurals)
            .map(([key, plural]) => {
                if (typeof transformer.transformPluralsValues === 'function') {
                    return transformer.transformPluralsValues(key, plural);
                }

                return '';
            })
            .join(EOL);

        return valueToInsert;
    }
}

export default FileWriter;
