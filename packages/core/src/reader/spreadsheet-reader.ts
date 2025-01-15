import { GoogleSpreadsheet } from 'google-spreadsheet';
import { GoogleAuth } from 'google-auth-library';

import Line from '../line.js';
import { FatalError, getErrorMessage } from '../errors.js';
import WorksheetReader from './worksheet-reader.js';
import Worksheet from './worksheet.js';
import defaultLogger from '../logger.js';
import type { Logger } from '../logger.js';
import type { PluginsRunner } from '../plugins/index.js';

export declare type WorksheetLinesByTitle = {
    [worksheetTitle: string]: Line[];
};
interface SpreadsheetReaderOptions {
    logger?: Logger;
}
export class SpreadsheetReader {
    private worksheets: Worksheet[] | null;

    public logger: Logger;

    constructor(
        private spreadsheetId: string,
        private sheetsReader: WorksheetReader,
        private plugins: PluginsRunner,
        options: SpreadsheetReaderOptions = {},
    ) {
        this.logger = options.logger || defaultLogger;

        this.worksheets = null;
    }

    createAuthClient() {
        this.logger.log('🔑 Authenticating with Application Default Credentials...');

        return new GoogleAuth({
            scopes: [
                'https://www.googleapis.com/auth/spreadsheets.readonly',
                'https://www.googleapis.com/auth/spreadsheets',
                'https://www.googleapis.com/auth/drive.file',
            ],
        });
    }

    async authenticate() {
        const auth = this.createAuthClient();

        return auth.getClient();
    }

    async fetchSheets(): Promise<Worksheet[]> {
        if (this.worksheets) {
            return this.worksheets;
        }

        const client = await this.authenticate();

        const spreadsheet = new GoogleSpreadsheet(this.spreadsheetId, client);

        try {
            await spreadsheet.loadInfo();
        } catch (error) {
            throw new FatalError(getErrorMessage(error));
        }

        this.worksheets = await this.sheetsReader.read(spreadsheet);

        return this.worksheets;
    }

    async read(keyColumn: string, valueColumn: string): Promise<WorksheetLinesByTitle> {
        const worksheets = await this.fetchSheets();
        const plugins = this.plugins;

        const worksheetsLines: WorksheetLinesByTitle = {};
        const processWorksheetsPromises = worksheets.map(async worksheet => {
            const { title } = worksheet;

            try {
                const lines = await worksheet.extractLines(keyColumn, valueColumn, plugins);

                if (worksheetsLines[title]) {
                    this.logger.warn(`🔀 Found two sheets with same title ${title}. We're gonna concat the data.`);

                    worksheetsLines[title] = [...worksheetsLines[title], ...lines];
                } else {
                    worksheetsLines[title] = lines;
                }
            } catch (error) {
                this.logger.warn(getErrorMessage(error));
            }
        });

        await Promise.all(processWorksheetsPromises);

        return worksheetsLines;
    }
}

export default SpreadsheetReader;
