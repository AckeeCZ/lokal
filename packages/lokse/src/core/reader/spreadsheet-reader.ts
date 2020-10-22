import { GoogleSpreadsheet } from "google-spreadsheet";
import { flatten } from "lodash";
import { CLIError } from "@oclif/errors";
import * as dedent from "dedent";

import Line from "../line";
import WorksheetReader, { Worksheet } from "./worksheet-reader";
import { isEqualCaseInsensitive } from "../../utils";

class MissingAuthError extends CLIError {
  constructor() {
    super(
      dedent`
        Cannot authenticate to fetch Spreadsheet data. 
          Provide either Service account credentials or API key 🔑 See detail info at https://github.com/AckeeCZ/lokse/tree/master/packages/lokse#authentication
        `
    );
    this.name = "MissingAuthError";
  }
}

class LoadDataError extends CLIError {
  constructor(reason: string) {
    super(reason);
    this.name = "LoadDataError";
  }
}

class ColumnDataError extends CLIError {
  constructor(reason: string) {
    super(reason, {
      exit: false,
    });
    this.name = "ColumnDataError";
  }
}

export class SpreadsheetReader {
  private spreadsheet: GoogleSpreadsheet;

  private sheetsReader: WorksheetReader;

  private worksheets: Worksheet[] | null;

  constructor(spreadsheetId: string, sheetsFilter?: string | null) {
    this.spreadsheet = new GoogleSpreadsheet(spreadsheetId);
    this.sheetsReader = new WorksheetReader(sheetsFilter);

    this.worksheets = null;
  }

  async authenticate() {
    const {
      LOKSE_API_KEY,
      LOKSE_SERVICE_ACCOUNT_EMAIL,
      LOKSE_PRIVATE_KEY,
    } = process.env;

    if (LOKSE_SERVICE_ACCOUNT_EMAIL && LOKSE_PRIVATE_KEY) {      
      await this.spreadsheet.useServiceAccountAuth({
        client_email: LOKSE_SERVICE_ACCOUNT_EMAIL,
        // Treat new lines properly - https://stackoverflow.com/a/36439803/7051731
        private_key: LOKSE_PRIVATE_KEY.replace(/\\n/g, '\n'),
      });
    } else if (LOKSE_API_KEY) {
      this.spreadsheet.useApiKey(LOKSE_API_KEY);
    } else {
      throw new MissingAuthError();
    }
  }

  async fetchSheets() {
    if (!this.worksheets) {
      await this.authenticate();

      try {
        await this.spreadsheet.loadInfo();
      } catch (error) {
        throw new LoadDataError(error.message);
      }

      this.worksheets = await this.sheetsReader.read(this.spreadsheet);
    }

    return this.worksheets;
  }

  extractFromWorksheet(
    worksheet: Worksheet,
    keyColumn: string,
    valueColumn: string
  ) {
    let keyColumnId = "";
    let valueColumnId = "";

    for (const headerKey of worksheet.header) {
      if (isEqualCaseInsensitive(headerKey, keyColumn)) {
        keyColumnId = headerKey;
      }
      if (isEqualCaseInsensitive(headerKey, valueColumn)) {
        valueColumnId = headerKey;
      }
    }

    if (!keyColumnId) {
      throw new LoadDataError(`Key column "${keyColumn}" not found!`);
    }

    if (!valueColumnId) {
      throw new ColumnDataError(`Language column "${valueColumn}" not found!`);
    }

    return worksheet.rows.map(
      (row) => new Line(row[keyColumnId], row[valueColumnId])
    );
  }

  async read(keyColumn: string, valueColumn: string) {
    const worksheets = await this.fetchSheets();

    const extractedLines: Line[][] = worksheets.map((worksheet) => {
      const worksheetLines = this.extractFromWorksheet(
        worksheet,
        keyColumn,
        valueColumn
      );

      return worksheetLines;
    });

    return flatten(extractedLines);
  }
}

export default SpreadsheetReader;
