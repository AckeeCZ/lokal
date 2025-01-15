import bluebird from 'bluebird';
import isPlainObject from 'lodash/isPlainObject.js';
import type { GoogleSpreadsheet, GoogleSpreadsheetWorksheet } from 'google-spreadsheet';
import { forceArray, isEqualCaseInsensitive } from '../utils.js';
import Worksheet from './worksheet.js';
import defaultLogger from '../logger.js';
import type { Logger } from '../logger.js';

const { all } = bluebird;

export class InvalidFilterError extends Error {
    public filterStringified: string;

    constructor(filter: unknown) {
        const filterStringified = JSON.stringify(filter);
        super(
            `💥 Invalid sheets filter provided: ${filterStringified}. Look at the supported filter format reference.`,
        );

        this.filterStringified = filterStringified;
    }
}

type SheetTitle = string;

type SheetIndexOrTitle = number | SheetTitle;

interface SheetFilterComplex {
    include: SheetIndexOrTitle[];
    exclude: SheetIndexOrTitle[];
}

export type SheetsFilter =
    | SheetTitle
    | SheetIndexOrTitle[]
    | {
          include?: string | SheetIndexOrTitle[];
          exclude?: string | SheetIndexOrTitle[];
      };

interface WorksheetReaderOptions {
    logger?: Logger;
}

class WorksheetReader {
    static ALL_SHEETS_FILTER = '*';

    public filter: SheetFilterComplex;

    public logger: Logger;

    constructor(filter?: SheetsFilter | null, options: WorksheetReaderOptions = {}) {
        this.logger = options.logger || defaultLogger;

        this.filter = WorksheetReader.normalizeFilter(filter);
    }

    static normalizeFilter(filter?: SheetsFilter | null): SheetFilterComplex {
        if (!filter || filter === WorksheetReader.ALL_SHEETS_FILTER) {
            return {
                include: [WorksheetReader.ALL_SHEETS_FILTER],
                exclude: [],
            };
        }

        if (typeof filter === 'string' || Array.isArray(filter)) {
            return {
                include: forceArray(filter),
                exclude: [],
            };
        }

        if (isPlainObject(filter)) {
            return {
                include: forceArray(filter.include ?? WorksheetReader.ALL_SHEETS_FILTER),
                exclude: forceArray(filter.exclude ?? []),
            };
        }

        throw new InvalidFilterError(filter);
    }

    static isSheetInTheList(worksheet: GoogleSpreadsheetWorksheet, list: SheetIndexOrTitle[]): boolean {
        return list.some((sheetFilter: string | number) => {
            if (sheetFilter === WorksheetReader.ALL_SHEETS_FILTER) {
                return true;
            }

            if (typeof sheetFilter === 'number' && worksheet.index === sheetFilter) {
                return true;
            }

            if (typeof sheetFilter === 'string' && isEqualCaseInsensitive(worksheet.title, sheetFilter)) {
                return true;
            }

            return false;
        });
    }

    shouldUseWorksheet(worksheet: GoogleSpreadsheetWorksheet): boolean {
        const { include, exclude } = this.filter;

        const isIncluded = WorksheetReader.isSheetInTheList(worksheet, include);
        const isExcluded = WorksheetReader.isSheetInTheList(worksheet, exclude);

        return isIncluded && !isExcluded;
    }

    async loadSheet(worksheet: GoogleSpreadsheetWorksheet): Promise<Worksheet> {
        const rows = await worksheet.getRows();

        return new Worksheet(worksheet.title, worksheet.headerValues, rows);
    }

    async read(spreadsheet: GoogleSpreadsheet): Promise<Worksheet[]> {
        const worksheets = spreadsheet.sheetsByIndex.filter(worksheet => this.shouldUseWorksheet(worksheet));

        if (worksheets.length === 0) {
            let message = `Couldn't find any sheets`;

            const existingSheets = Object.keys(spreadsheet.sheetsByTitle);
            const { include, exclude } = this.filter;

            const filterStringified = [
                include.length > 0 && `include: ${include.toString()}`,
                exclude.length > 0 && `exclude: ${exclude.toString()}`,
            ]
                .filter(Boolean)
                .join(', ');

            message += ` that match the filter ${filterStringified}. Existing sheets are ${existingSheets}`;

            this.logger.warn(`${message}. `);
        }

        const sheets = await all(worksheets.map(worksheet => this.loadSheet(worksheet)));

        return sheets;
    }
}

export default WorksheetReader;
