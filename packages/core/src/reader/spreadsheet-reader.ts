import { GoogleSpreadsheet } from "google-spreadsheet";

import Line from "../line";
import { MissingAuthError, FatalError } from "../errors";
import WorksheetReader from "./worksheet-reader";
import Worksheet from "./worksheet";
import defaultLogger from "../logger";
import type { Logger } from "../logger";

export declare type WorksheetLinesByTitle = {
  [worksheetTitle: string]: Line[];
};

interface SpreadsheetReaderOptions {
  logger?: Logger;
}
export class SpreadsheetReader {
  private spreadsheet: GoogleSpreadsheet;

  private sheetsReader: WorksheetReader;

  private worksheets: Worksheet[] | null;

  public logger: Logger;

  constructor(
    spreadsheetId: string,
    sheetsReader: WorksheetReader,
    options: SpreadsheetReaderOptions = {}
  ) {
    this.logger = options.logger || defaultLogger;

    this.spreadsheet = new GoogleSpreadsheet(spreadsheetId);
    this.sheetsReader = sheetsReader;

    this.worksheets = null;
  }

  async authenticate() {
    const { LOKSE_API_KEY, LOKSE_SERVICE_ACCOUNT_EMAIL, LOKSE_PRIVATE_KEY } =
      process.env;

    if (LOKSE_SERVICE_ACCOUNT_EMAIL && LOKSE_PRIVATE_KEY) {
      await this.spreadsheet.useServiceAccountAuth({
        client_email: LOKSE_SERVICE_ACCOUNT_EMAIL,
        // Treat new lines properly - https://stackoverflow.com/a/36439803/7051731
        private_key: LOKSE_PRIVATE_KEY.replace(/\\n/g, "\n"),
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
        throw new FatalError(error.message);
      }

      this.worksheets = await this.sheetsReader.read(this.spreadsheet);
    }

    return this.worksheets;
  }

  async read(keyColumn: string, valueColumn: string) {
    const worksheets = await this.fetchSheets();

    return worksheets.reduce(
      (worksheetLines: WorksheetLinesByTitle, worksheet) => {
        const { title } = worksheet;

        try {
          const lines = worksheet.extractLines(keyColumn, valueColumn);

          if (worksheetLines[title]) {
            this.logger.warn(
              `🔀 Found two sheets with same title ${title}. We're gonna concat the data.`
            );

            worksheetLines[title] = worksheetLines[title].concat(lines);
          } else {
            worksheetLines[title] = lines;
          }
        } catch (error) {
          this.logger.warn(error.message);
        }

        return worksheetLines;
      },
      {}
    );
  }
}

export default SpreadsheetReader;
