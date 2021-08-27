import { GoogleSpreadsheet } from "google-spreadsheet";
import SpreadsheetReader from "../spreadsheet-reader";
import WorksheetReader from "../worksheet-reader";
import {
  LangColumnNotFound,
  KeyColumnNotFound,
  MissingAuthError,
} from "../../errors";
import Line from "../../line";
import Worksheet from "../worksheet";

const GoogleSpreadsheetMock = GoogleSpreadsheet as jest.Mock;

jest.mock("google-spreadsheet");

describe("SpreadsheetReader", () => {
  const testLogger = {
    log: jest.fn(),
    warn: jest.fn(),
  };

  describe("authenticate", () => {
    beforeEach(() => {
      GoogleSpreadsheetMock.mockClear();
    });

    afterEach(() => {
      delete process.env.LOKSE_API_KEY;
      delete process.env.LOKSE_SERVICE_ACCOUNT_EMAIL;
      delete process.env.LOKSE_PRIVATE_KEY;
    });

    it("uses service account if available", async () => {
      expect.assertions(2);
      const private_key = "this-is-dummy-private-key";
      const client_email = "this-is@dummy-email";
      process.env.LOKSE_SERVICE_ACCOUNT_EMAIL = client_email;
      process.env.LOKSE_PRIVATE_KEY = private_key;

      const reader = new SpreadsheetReader(
        "test-sheet-id",
        new WorksheetReader("*")
      );
      await reader.authenticate();

      const useServiceAccountAuthMock =
        GoogleSpreadsheetMock.mock.instances[0].useServiceAccountAuth;
      expect(useServiceAccountAuthMock).toHaveBeenCalledTimes(1);
      expect(useServiceAccountAuthMock).toHaveBeenLastCalledWith({
        client_email,
        private_key,
      });
    });

    it("uses api key if available", async () => {
      expect.assertions(2);
      const dummyApiKey = "dummy-api-key";
      process.env.LOKSE_API_KEY = dummyApiKey;

      const reader = new SpreadsheetReader(
        "test-sheet-id",
        new WorksheetReader("*")
      );
      await reader.authenticate();

      const useApiKeyMock = GoogleSpreadsheetMock.mock.instances[0].useApiKey;
      expect(useApiKeyMock).toHaveBeenCalledTimes(1);
      expect(useApiKeyMock).toHaveBeenLastCalledWith(dummyApiKey);
    });

    it("throw if service account nor api key found", async () => {
      expect.assertions(1);
      const expectedError = new MissingAuthError();

      const reader = new SpreadsheetReader(
        "test-sheet-id",
        new WorksheetReader("*")
      );

      await expect(reader.authenticate()).rejects.toHaveProperty(
        "message",
        expectedError.message
      );
    });
  });

  describe("read", () => {
    const makeFakeLine = (id: string) => {
      return { id: `line_${id}` } as unknown as Line;
    };

    const makeFakeWorksheet = (title: string, lines: Line[]) => {
      const fakeWorksheet = {
        title,
        extractLines: jest.fn().mockReturnValue(lines),
      };
      return fakeWorksheet as unknown as Worksheet;
    };

    const linesSet1 = [makeFakeLine("1_1"), makeFakeLine("1_2")];

    const linesSet2 = [
      makeFakeLine("2_1"),
      makeFakeLine("2_2"),
      makeFakeLine("2_3"),
    ];

    const linesSet3 = [makeFakeLine("3_1")];

    beforeEach(() => {
      testLogger.warn.mockReset();
    });

    it("should return map of lines by sheet title", async () => {
      expect.assertions(1);

      const sheetsList = [
        makeFakeWorksheet("fakeSheet1", linesSet1),
        makeFakeWorksheet("fakeSheet2", linesSet2),
        makeFakeWorksheet("fakeSheet3", linesSet3),
      ];

      const reader = new SpreadsheetReader(
        "test-sheet-id",
        new WorksheetReader("*"),
        { logger: testLogger }
      );
      jest.spyOn(reader, "fetchSheets").mockResolvedValue(sheetsList);

      await expect(reader.read("key", "en-gb")).resolves.toEqual({
        fakeSheet1: linesSet1,
        fakeSheet2: linesSet2,
        fakeSheet3: linesSet3,
      });
    });

    it("should omit sheet in map lines when extracting fail from any reason", async () => {
      expect.assertions(4);

      const sheetsList = [
        makeFakeWorksheet("fakeSheet1", linesSet1),
        makeFakeWorksheet("fakeSheet2", linesSet2),
        makeFakeWorksheet("fakeSheet3", linesSet2),
        makeFakeWorksheet("fakeSheet4", linesSet3),
      ];

      const mockLangColError = new LangColumnNotFound(
        "en-gb",
        sheetsList[1].title
      );
      (sheetsList[1].extractLines as jest.Mock).mockImplementationOnce(() => {
        throw mockLangColError;
      });

      const mockKeyColError = new KeyColumnNotFound("key", sheetsList[2].title);
      (sheetsList[2].extractLines as jest.Mock).mockImplementationOnce(() => {
        throw mockKeyColError;
      });

      const reader = new SpreadsheetReader(
        "test-sheet-id",
        new WorksheetReader("*"),
        { logger: testLogger }
      );
      jest.spyOn(reader, "fetchSheets").mockResolvedValue(sheetsList);

      await expect(reader.read("key", "en-gb")).resolves.toEqual({
        fakeSheet1: linesSet1,
        fakeSheet4: linesSet3,
      });
      expect(testLogger.warn).toHaveBeenCalledTimes(2);
      expect(testLogger.warn).toHaveBeenNthCalledWith(
        1,
        expect.stringContaining(mockLangColError.message)
      );
      expect(testLogger.warn).toHaveBeenNthCalledWith(
        2,
        expect.stringContaining(mockKeyColError.message)
      );
    });

    it("should concat sheets with same title", async () => {
      expect.assertions(3);

      const sheetsList = [
        makeFakeWorksheet("fakeSheet1", linesSet1),
        makeFakeWorksheet("fakeSheet2", linesSet2),
        makeFakeWorksheet("fakeSheet1", linesSet3),
      ];

      const reader = new SpreadsheetReader(
        "test-sheet-id",
        new WorksheetReader("*"),
        { logger: testLogger }
      );
      jest.spyOn(reader, "fetchSheets").mockResolvedValue(sheetsList);

      await expect(reader.read("key", "en-gb")).resolves.toEqual({
        fakeSheet1: linesSet1.concat(linesSet3),
        fakeSheet2: linesSet2,
      });
      expect(testLogger.warn).toHaveBeenCalledTimes(1);
      expect(testLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining(
          `🔀 Found two sheets with same title fakeSheet1`
        )
      );
    });
  });
});
