import { test as oclifTest } from "@oclif/test";
import { cosmiconfigSync } from "cosmiconfig";
import * as dedent from "dedent";
import { when } from "jest-when";

import Reader from "../../core/reader/spreadsheet-reader";
import { FileWriter } from "../../core/writer";
import { OutputFormat } from "../../constants";
import { noExitCliInvariant } from "../../utils";
import jsonTransformer from "../../core/transformer/json";

jest.mock("cosmiconfig");
const explorerMock = {
  search: jest.fn(),
};
(cosmiconfigSync as jest.Mock).mockReturnValue(explorerMock);

const mockOraInstance = {
  start: jest.fn(),
  warn: jest.fn(),
  succeed: jest.fn(),
  fail: jest.fn(),
};
jest.mock("ora", () => jest.fn().mockReturnValue(mockOraInstance));

// File writer mock
jest.mock("../../core/writer");
const mockWrite = jest.fn();
const FileWriterMock = FileWriter as jest.Mock;
FileWriterMock.mockReturnValue({
  write: mockWrite,
});

// Spreadsheet reader mock
jest.mock("../../core/reader/spreadsheet-reader");
const mockRead = jest.fn();
const ReaderMock = Reader as jest.Mock;
ReaderMock.mockReturnValue({
  read: mockRead,
});

const outputFormats = Object.values(OutputFormat).join(", ");

describe("update command", () => {
  let consoleErrorBackup: typeof console.error;
  const fakeSpreadsheetId = "fake-spreadsheet-id";
  const keyColumn = "web";
  const translationsDir = "src/translations";
  const languages = ["cs", "en-us", "en-gb"];
  const params = {
    id: `--id=${fakeSpreadsheetId}`,
    dir: `--dir=${translationsDir}`,
    col: `--col=${keyColumn}`,
    langs: `--languages=${languages.join(",")}`,
    format: `--format=json`,
  };

  const mockSheetLines = [{ key: "sheet1.line" }, { key: "sheet1.line" }];
  const mockSheetLines2 = [{ key: "sheet2.line_1" }, { key: "sheet2.line_2" }];
  const mockSheetLines3 = [{ key: "sheet3.line_1" }, { key: "sheet3.line_2" }];

  const test = oclifTest.register("setupMocks", () => ({
    /* eslint-disable no-console */
    run() {
      ReaderMock.mockClear();
      mockRead.mockClear().mockReturnValue(mockSheetLines);
      FileWriterMock.mockClear();
      mockWrite.mockClear();

      mockOraInstance.start.mockClear();
      mockOraInstance.warn.mockClear();
      mockOraInstance.succeed.mockClear();
      mockOraInstance.fail.mockClear();

      explorerMock.search.mockReset();
      /**
       * Mocking error output with https://www.npmjs.com/package/fancy-test#stdoutstderr-mocking
       * doesn't work as Jest somehow wraps error output by itself. Therefore we need to mock
       * console.error and check what was send into it
       */
      consoleErrorBackup = console.error;
      console.error = jest.fn();
    },
    finally() {
      console.error = consoleErrorBackup;
    },
  }));

  test
    .command(["update"])
    .catch((error) => {
      expect(error.message).toEqual(
        `💥 Sheet id is required for updating translations`
      );
    })
    .it("throws when id not provided");

  test
    .command(["update", params.id])
    .catch((error) => {
      expect(error.message).toEqual(
        `💥 Output directory is required for updating translations`
      );
    })
    .it("throws when output directory not provided");

  test
    .command(["update", params.id, params.dir])
    .catch((error) => {
      expect(error.message).toEqual(
        `💥 Keys column is required for updating translations`
      );
    })
    .it("throws when keys column not provided");

  test
    .command(["update", params.id, params.dir, params.col])
    .catch((error) => {
      expect(error.message).toEqual(
        `🤷‍♂️ Translation columns have to be list of languages, but undefined given`
      );
    })
    .it("throws when languages list not provided");

  test
    .do(() =>
      explorerMock.search.mockReturnValue({
        config: { languages: "cs,en" },
      })
    )
    .command(["update", params.id, params.dir, params.col])
    .catch((error) => {
      expect(error.message).toEqual(
        `🤷‍♂️ Translation columns have to be list of languages, but cs,en given`
      );
    })
    .it("throws when languages list is not an array");

  test
    .command(["update", "--format=unknown_format"])
    .catch((error) => {
      expect(error.message).toContain(
        `Expected --format=unknown_format to be one of: ${outputFormats}`
      );
    })
    .it("throws when unknown format provided");

  test
    .setupMocks()
    .command(["update", ...Object.values(params)])
    .it("set empty filter when no one supplied", () => {
      expect(true).toBe(true);
      expect(ReaderMock.mock.instances).toHaveLength(1);
      expect(ReaderMock.mock.instances[0][1]).toBeUndefined();
    });

  test
    .setupMocks()
    .command(["update", ...Object.values(params), "--sheets=Main translations"])
    .it("uses filter when only one name supplied", () => {
      expect(ReaderMock.mock.instances).toHaveLength(1);
      expect(ReaderMock.mock.calls[0][1]).toEqual(["Main translations"]);
    });

  test
    .setupMocks()
    .command([
      "update",
      ...Object.values(params),
      "--sheets=Main translations,Secondary translations",
    ])
    .it("parses and uses filter when list of names supplied", () => {
      expect(ReaderMock.mock.instances).toHaveLength(1);
      expect(ReaderMock.mock.calls[0][1]).toEqual([
        "Main translations",
        "Secondary translations",
      ]);
    });

  test
    .setupMocks()
    .do(() => explorerMock.search.mockReturnValue({ config: { sheets: true } }))
    .command(["update", ...Object.values(params)])
    .catch((error) => {
      expect(error.message).toEqual(
        `🤷‍♂️ Sheets filter have to be string name or array of names, but ${true} given`
      );
    })
    .it("throws when filter is not a string or list of string");

  test
    .setupMocks()
    .do(() =>
      explorerMock.search.mockReturnValue({
        config: { sheets: "Secondary translations" },
      })
    )
    .command(["update", ...Object.values(params)])
    .it("uses string filter supplied through config", () => {
      expect(ReaderMock.mock.instances).toHaveLength(1);
      expect(ReaderMock.mock.calls[0][1]).toEqual("Secondary translations");
    });

  test
    .setupMocks()
    .do(() =>
      explorerMock.search.mockReturnValue({
        config: { sheets: ["Main translations", "Secondary translations"] },
      })
    )
    .command(["update", ...Object.values(params)])
    .it("uses names list filter supplied through config", () => {
      expect(ReaderMock.mock.instances).toHaveLength(1);
      expect(ReaderMock.mock.calls[0][1]).toEqual([
        "Main translations",
        "Secondary translations",
      ]);
    });

  test
    .setupMocks()
    .command(["update", ...Object.values(params)])
    .it("reads data for each language", () => {
      expect(ReaderMock.mock.instances).toHaveLength(1);
      expect(ReaderMock.mock.calls[0][0]).toEqual(fakeSpreadsheetId);

      expect(mockRead).toHaveBeenCalledTimes(3);
      expect(mockRead).toHaveBeenNthCalledWith(1, keyColumn, languages[0]);
      expect(mockRead).toHaveBeenNthCalledWith(2, keyColumn, languages[1]);
      expect(mockRead).toHaveBeenNthCalledWith(3, keyColumn, languages[2]);
    });

  test
    .setupMocks()
    .do(() => mockRead.mockReturnValue({}))
    .command(["update", ...Object.values(params)])
    .it("doesnt write language data when lines set is empty", () => {
      expect(mockWrite).not.toHaveBeenCalled();

      expect(mockOraInstance.warn).toHaveBeenCalledTimes(3);
      expect(mockOraInstance.warn).toHaveBeenNthCalledWith(
        1,
        `Received empty lines set for language ${languages[0]}`
      );
      expect(mockOraInstance.warn).toHaveBeenNthCalledWith(
        2,
        `Received empty lines set for language ${languages[1]}`
      );
      expect(mockOraInstance.warn).toHaveBeenNthCalledWith(
        3,
        `Received empty lines set for language ${languages[2]}`
      );
    });

  test
    .setupMocks()
    .do(() => mockRead.mockReturnValue({ sheet1: mockSheetLines }))
    .stub(process, "cwd", jest.fn().mockReturnValue("/ROOT_PKG_PATH"))
    .command(["update", ...Object.values(params)])
    .it("writes language data in desired format into the output dir", () => {
      let relPath = "";

      expect(mockWrite).toHaveBeenCalledTimes(3);
      expect(mockOraInstance.succeed).toHaveBeenCalledTimes(3);

      relPath = `${translationsDir}/${languages[0]}.json`;
      expect(mockWrite.mock.calls[0][0]).toEqual(`/ROOT_PKG_PATH/${relPath}`);
      expect(mockWrite.mock.calls[0][1]).toEqual(mockSheetLines);
      expect(mockOraInstance.succeed).toHaveBeenNthCalledWith(
        1,
        `All ${languages[0]} translations saved into ${relPath}`
      );

      relPath = `${translationsDir}/${languages[1]}.json`;
      expect(mockWrite.mock.calls[1][0]).toEqual(`/ROOT_PKG_PATH/${relPath}`);
      expect(mockWrite.mock.calls[1][1]).toEqual(mockSheetLines);
      expect(mockOraInstance.succeed).toHaveBeenNthCalledWith(
        2,
        `All ${languages[1]} translations saved into ${relPath}`
      );

      relPath = `${translationsDir}/${languages[2]}.json`;
      expect(mockWrite.mock.calls[2][0]).toEqual(`/ROOT_PKG_PATH/${relPath}`);
      expect(mockOraInstance.succeed).toHaveBeenNthCalledWith(
        3,
        `All ${languages[2]} translations saved into ${relPath}`
      );
    });

  test
    .setupMocks()
    .stderr()
    .do(() => {
      mockRead
        .mockImplementationOnce(() => ({ sheet1: mockSheetLines }))
        .mockImplementationOnce(() => {
          throw new Error("Read spreadsheet error");
        });
    })
    .command(["update", ...Object.values(params)])
    .catch((error) => {
      expect(mockRead).toHaveBeenCalledTimes(2);
      expect(mockWrite).toHaveBeenCalledTimes(1);

      expect(mockOraInstance.fail).toHaveBeenCalledTimes(1);
      expect(mockOraInstance.fail).toHaveBeenCalledWith(
        `Generating ${languages[1]} translations failed.`
      );

      expect(mockOraInstance.succeed).toHaveBeenCalledTimes(1);
      expect(mockOraInstance.succeed).toHaveBeenCalledWith(
        `All ${languages[0]} translations saved into ${translationsDir}/${languages[0]}.json`
      );
      expect(error.message).toEqual("Read spreadsheet error");
    })
    .it("print error when process of reading or writing fails");

  test
    .setupMocks()
    .do(() => {
      mockRead
        .mockImplementationOnce((_, lang) => {
          noExitCliInvariant(false, `No exit read ${lang} error`);
        })
        .mockImplementation(() => mockSheetLines);
      mockWrite.mockImplementationOnce(() => {
        noExitCliInvariant(false, "No exit write translations error");
      });
    })
    .command(["update", ...Object.values(params)])
    .it(
      "goes through other langs when non critical error occur during read or write",
      () => {
        expect(mockRead).toHaveBeenCalledTimes(3);
        expect(mockWrite).toHaveBeenCalledTimes(2);

        expect(mockOraInstance.fail).toHaveBeenCalledTimes(2);
        expect(mockOraInstance.fail).toHaveBeenNthCalledWith(
          1,
          `Generating ${languages[0]} translations failed.`
        );
        expect(mockOraInstance.fail).toHaveBeenNthCalledWith(
          2,
          `Generating ${languages[1]} translations failed.`
        );

        expect(mockOraInstance.succeed).toHaveBeenCalledTimes(1);
        expect(mockOraInstance.succeed).toHaveBeenCalledWith(
          `All ${languages[2]} translations saved into ${translationsDir}/${languages[2]}.json`
        );

        expect(console.error).toHaveBeenCalledTimes(2);
        expect((console.error as jest.Mock).mock.calls[0][0]).toContain(
          "No exit read cs error"
        );
        expect((console.error as jest.Mock).mock.calls[1][0]).toContain(
          "No exit write translations error"
        );
      }
    );

  describe("Splitting translations", () => {
    const langsParam = `--languages=${languages[0]},${languages[1]}`;
    const threeSheets = {
      "sheet1 Title": mockSheetLines,
      "sheet2 Title": mockSheetLines2,
      "sheet3 Title": mockSheetLines3,
    };

    test.it("fail when splitTranslations isnt boolean nor array of strings");

    test
      .setupMocks()
      .do(() => {
        mockRead.mockReturnValue(threeSheets);
        explorerMock.search.mockReturnValue({
          config: { splitTranslations: true },
        });
      })
      .stub(process, "cwd", jest.fn().mockReturnValue("/ROOT_PKG_PATH"))
      .command([
        "update",
        ...Object.values(params),
        langsParam,
        `--format=android`,
      ])
      .it(
        "doesnt split when option enabled but output transformer doesnt support it",
        () => {
          let relPath = "";

          expect(mockWrite).toHaveBeenCalledTimes(2);
          expect(mockOraInstance.succeed).toHaveBeenCalledTimes(2);

          const writeCalls = mockWrite.mock.calls;

          relPath = `${translationsDir}/values-${languages[0]}strings.xml`;
          expect(writeCalls[0][0]).toEqual(`/ROOT_PKG_PATH/${relPath}`);
          expect(writeCalls[0][1]).toEqual([
            ...mockSheetLines,
            ...mockSheetLines2,
            ...mockSheetLines3,
          ]);

          expect(mockOraInstance.succeed).toHaveBeenNthCalledWith(
            1,
            `All ${languages[0]} translations saved into ${relPath}`
          );

          relPath = `${translationsDir}/values-${languages[1]}strings.xml`;
          expect(writeCalls[1][0]).toEqual(`/ROOT_PKG_PATH/${relPath}`);
          expect(writeCalls[1][1]).toEqual([
            ...mockSheetLines,
            ...mockSheetLines2,
            ...mockSheetLines3,
          ]);

          expect(mockOraInstance.succeed).toHaveBeenNthCalledWith(
            2,
            `All ${languages[1]} translations saved into ${relPath}`
          );
        }
      );

    test
      .setupMocks()
      .stub(process, "cwd", jest.fn().mockReturnValue("/ROOT_PKG_PATH"))
      .do(() => {
        mockRead.mockReturnValue(threeSheets);
        explorerMock.search.mockReturnValue({
          config: { splitTranslations: true },
        });
      })
      .command(["update", ...Object.values(params), langsParam])
      .it("splits by sheet title when split option is true", () => {
        expect(mockWrite).toHaveBeenCalledTimes(6);
        expect(mockOraInstance.succeed).toHaveBeenCalledTimes(2);

        const writeCalls = mockWrite.mock.calls;

        expect(writeCalls[0][0]).toEqual(
          `/ROOT_PKG_PATH/${translationsDir}/sheet1-title.${languages[0]}.json`
        );
        expect(writeCalls[0][1]).toEqual(mockSheetLines);
        expect(writeCalls[1][0]).toEqual(
          `/ROOT_PKG_PATH/${translationsDir}/sheet2-title.${languages[0]}.json`
        );
        expect(writeCalls[1][1]).toEqual(mockSheetLines2);
        expect(writeCalls[2][0]).toEqual(
          `/ROOT_PKG_PATH/${translationsDir}/sheet3-title.${languages[0]}.json`
        );
        expect(writeCalls[2][1]).toEqual(mockSheetLines3);

        expect(mockOraInstance.succeed).toHaveBeenNthCalledWith(
          1,
          dedent`All ${languages[0]} translations saved into ${translationsDir}
                Splitted to sheet1-title, sheet2-title, sheet3-title`
        );

        expect(writeCalls[3][0]).toEqual(
          `/ROOT_PKG_PATH/${translationsDir}/sheet1-title.${languages[1]}.json`
        );
        expect(writeCalls[3][1]).toEqual(mockSheetLines);
        expect(writeCalls[4][0]).toEqual(
          `/ROOT_PKG_PATH/${translationsDir}/sheet2-title.${languages[1]}.json`
        );
        expect(writeCalls[4][1]).toEqual(mockSheetLines2);
        expect(writeCalls[5][0]).toEqual(
          `/ROOT_PKG_PATH/${translationsDir}/sheet3-title.${languages[1]}.json`
        );
        expect(writeCalls[5][1]).toEqual(mockSheetLines3);

        expect(mockOraInstance.succeed).toHaveBeenNthCalledWith(
          2,
          dedent`All ${languages[1]} translations saved into ${translationsDir}
                Splitted to sheet1-title, sheet2-title, sheet3-title`
        );
      });

    test
      .setupMocks()
      .do(() => {
        mockRead.mockReturnValue({ "Sheet 1": mockSheetLines });
        explorerMock.search.mockReturnValue({
          config: { splitTranslations: true },
        });
      })
      .stub(process, "cwd", jest.fn().mockReturnValue("/ROOT_PKG_PATH"))
      .command(["update", ...Object.values(params), langsParam])
      .it(
        "warns if there is only one sheet so splitting is unnecessary",
        () => {
          expect(mockWrite).toHaveBeenCalledTimes(2);
          expect(mockOraInstance.succeed).toHaveBeenCalledTimes(2);

          const writeCalls = mockWrite.mock.calls;

          expect(writeCalls[0][0]).toEqual(
            `/ROOT_PKG_PATH/${translationsDir}/sheet-1.${languages[0]}.json`
          );
          expect(writeCalls[0][1]).toEqual(mockSheetLines);

          expect(writeCalls[1][0]).toEqual(
            `/ROOT_PKG_PATH/${translationsDir}/sheet-1.${languages[1]}.json`
          );
          expect(writeCalls[1][1]).toEqual(mockSheetLines);

          expect(console.error).toHaveBeenCalledTimes(2);
          expect((console.error as jest.Mock).mock.calls[0][0]).toContain(
            `Requested splitting translations by sheet but`
          );
        }
      );

    test
      .setupMocks()
      .do(() => {
        mockRead.mockReturnValue(threeSheets);
        explorerMock.search.mockReturnValue({
          config: { splitTranslations: ["sheet1", "sheet3"] },
        });
      })
      .stub(process, "cwd", jest.fn().mockReturnValue("/ROOT_PKG_PATH"))
      .command(["update", ...Object.values(params), langsParam])
      .it(
        "split translations by specified domains and put rest into the general",
        () => {
          expect(mockWrite).toHaveBeenCalledTimes(6);
          expect(mockOraInstance.succeed).toHaveBeenCalledTimes(2);

          const writeCalls = mockWrite.mock.calls;

          expect(writeCalls[0][0]).toEqual(
            `/ROOT_PKG_PATH/${translationsDir}/sheet1.${languages[0]}.json`
          );
          expect(writeCalls[0][1]).toEqual(mockSheetLines);

          expect(writeCalls[1][0]).toEqual(
            `/ROOT_PKG_PATH/${translationsDir}/sheet3.${languages[0]}.json`
          );
          expect(writeCalls[1][1]).toEqual(mockSheetLines3);

          expect(writeCalls[2][0]).toEqual(
            `/ROOT_PKG_PATH/${translationsDir}/${languages[0]}.json`
          );
          expect(writeCalls[2][1]).toEqual(mockSheetLines2);

          expect(mockOraInstance.succeed).toHaveBeenNthCalledWith(
            1,
            dedent`All ${languages[0]} translations saved into ${translationsDir}
                  Splitted to sheet1, sheet3, other`
          );

          expect(writeCalls[3][0]).toEqual(
            `/ROOT_PKG_PATH/${translationsDir}/sheet1.${languages[1]}.json`
          );
          expect(writeCalls[3][1]).toEqual(mockSheetLines);

          expect(writeCalls[4][0]).toEqual(
            `/ROOT_PKG_PATH/${translationsDir}/sheet3.${languages[1]}.json`
          );
          expect(writeCalls[4][1]).toEqual(mockSheetLines3);

          expect(writeCalls[5][0]).toEqual(
            `/ROOT_PKG_PATH/${translationsDir}/${languages[1]}.json`
          );
          expect(writeCalls[5][1]).toEqual(mockSheetLines2);

          expect(mockOraInstance.succeed).toHaveBeenNthCalledWith(
            2,
            dedent`All ${languages[1]} translations saved into ${translationsDir}
                  Splitted to sheet1, sheet3, other`
          );
        }
      );

    test
      .setupMocks()
      .stub(process, "cwd", jest.fn().mockReturnValue("/ROOT_PKG_PATH"))
      .do(() => {
        mockRead.mockReturnValue(threeSheets);

        when(mockWrite)
          .calledWith(
            `/ROOT_PKG_PATH/${translationsDir}/sheet2-title.${languages[0]}.json`,
            mockSheetLines2,
            jsonTransformer
          )
          .mockImplementationOnce(() => {
            throw new Error(`Write error`);
          });
        when(mockWrite)
          .calledWith(
            `/ROOT_PKG_PATH/${translationsDir}/sheet1-title.${languages[1]}.json`,
            mockSheetLines,
            jsonTransformer
          )
          .mockImplementationOnce(() => {
            throw new Error(`Write error 2`);
          });

        explorerMock.search.mockReturnValue({
          config: { splitTranslations: true },
        });
      })
      .command(["update", ...Object.values(params), langsParam])
      .it("write other domain translations if writing one of them fail", () => {
        expect(mockWrite).toHaveBeenCalledTimes(6);
        expect(mockOraInstance.warn).toHaveBeenCalledTimes(2);

        const writeCalls = mockWrite.mock.calls;

        expect(writeCalls[0][0]).toEqual(
          `/ROOT_PKG_PATH/${translationsDir}/sheet1-title.${languages[0]}.json`
        );
        expect(writeCalls[0][1]).toEqual(mockSheetLines);
        expect(writeCalls[1][0]).toEqual(
          `/ROOT_PKG_PATH/${translationsDir}/sheet2-title.${languages[0]}.json`
        );
        expect(writeCalls[1][1]).toEqual(mockSheetLines2);
        expect(writeCalls[2][0]).toEqual(
          `/ROOT_PKG_PATH/${translationsDir}/sheet3-title.${languages[0]}.json`
        );
        expect(writeCalls[2][1]).toEqual(mockSheetLines3);

        expect(mockOraInstance.warn).toHaveBeenNthCalledWith(
          1,
          `Some of ${languages[0]} splitted translations were not saved`
        );

        expect(writeCalls[3][0]).toEqual(
          `/ROOT_PKG_PATH/${translationsDir}/sheet1-title.${languages[1]}.json`
        );
        expect(writeCalls[3][1]).toEqual(mockSheetLines);
        expect(writeCalls[4][0]).toEqual(
          `/ROOT_PKG_PATH/${translationsDir}/sheet2-title.${languages[1]}.json`
        );
        expect(writeCalls[4][1]).toEqual(mockSheetLines2);
        expect(writeCalls[5][0]).toEqual(
          `/ROOT_PKG_PATH/${translationsDir}/sheet3-title.${languages[1]}.json`
        );
        expect(writeCalls[5][1]).toEqual(mockSheetLines3);

        expect(mockOraInstance.warn).toHaveBeenNthCalledWith(
          2,
          `Some of ${languages[1]} splitted translations were not saved`
        );
      });

    test
      // TODO
      .setupMocks()
      .do(() => {
        mockRead.mockReturnValue(threeSheets);
        explorerMock.search.mockReturnValue({
          config: { splitTranslations: true },
        });
      })
      .stub(process, "cwd", jest.fn().mockReturnValue("/ROOT_PKG_PATH"))
      .command(["update", ...Object.values(params), langsParam])
      .it(
        "should not create the other group when every translation belongs to any named group"
      );

    // TODO - maybe warn if notify that there is sheets filter turned
    // on and so not all sheets are included in processing
  });
});
