import { EOL } from "os";
import * as mkdirp from "mkdirp";

const fs = {
  accessAsync: jest.fn().mockResolvedValue(undefined),
  readFileAsync: jest.fn().mockResolvedValue(""),
  writeFileAsync: jest.fn().mockResolvedValue(undefined),
};

jest.mock("fs");
jest.mock("mkdirp");
jest.doMock("bluebird", () => ({
  ...jest.requireActual("bluebird"),
  promisifyAll: jest.fn().mockReturnValue(fs),
}));

import FileWriter from "../writer";
import Line from "../line";
import { transformersByFormat } from "../transformer";
import { OutputFormat } from "../constants";
import { PluginsRunner } from "../plugins";

const androidTransformer = transformersByFormat[OutputFormat.ANDROID];
const iosTransformer = transformersByFormat[OutputFormat.IOS];
const jsonTransformer = transformersByFormat[OutputFormat.JSON];

const logger = { warn: jest.fn(), log: jest.fn() };
const plugin = {
  pluginName: "test",
  transformFullOutput: jest.fn(),
  transformLine: jest.fn(),
};
const plugins = new PluginsRunner([plugin], { logger });

describe("Writer", () => {
  beforeEach(() => {
    plugin.transformFullOutput
      .mockReset()
      .mockImplementation((output) => output);
    plugin.transformLine.mockReset().mockImplementation((line) => line);

    ((fs as any).accessAsync as jest.Mock).mockClear();
    ((fs as any).readFileAsync as jest.Mock).mockClear();
    ((fs as any).writeFileAsync as jest.Mock).mockClear();
    (mkdirp as unknown as jest.Mock).mockResolvedValue(null);
  });

  describe(".write", () => {
    it("use transformer to compose output and write it", async () => {
      const writer = new FileWriter(plugins);
      await writer.write(
        { language: "cz", outputDir: "/" },
        [new Line("key", "value"), new Line("key2", "value2")],
        jsonTransformer
      );

      expect(fs.writeFileAsync).toHaveBeenCalledTimes(1);
      expect(fs.writeFileAsync).toHaveBeenCalledWith(
        "/cz.json",
        EOL +
          "{" +
          EOL +
          '  "key" : "value",' +
          EOL +
          '  "key2" : "value2"' +
          EOL +
          "}",
        "utf8"
      );
    });

    it("process output with hook", async () => {
      plugin.transformFullOutput.mockImplementation((output: string) => {
        return JSON.stringify(JSON.parse(output), null, 0);
      });
      const writer = new FileWriter(plugins);
      await writer.write(
        { language: "cz", outputDir: "/" },
        [new Line("key", "value"), new Line("key2", "value2")],
        jsonTransformer
      );

      expect(fs.writeFileAsync).toHaveBeenCalledTimes(1);
      expect(fs.writeFileAsync).toHaveBeenCalledWith(
        "/cz.json",
        '{"key":"value","key2":"value2"}',
        "utf8"
      );
    });
  });

  describe(".getTransformedLines", () => {
    it("process line with hook", async () => {
      plugin.transformLine.mockImplementation((line: Line) => {
        /* eslint-disable max-nested-callbacks */
        line.setKey((key) => key.toUpperCase());
        line.setValue((value) => value + " extended");
        /* eslint-enable max-nested-callbacks */
        return line;
      });

      const writer = new FileWriter(plugins);
      const result = await writer.getTransformedLines(
        [new Line("key", "value"), new Line("key2", "value2")],
        androidTransformer,
        { language: "" }
      );

      expect(result).toEqual(
        '    <string name="KEY">value extended</string>' +
          EOL +
          '    <string name="KEY2">value2 extended</string>'
      );
    });

    it("with android transformer should return xml", async () => {
      const writer = new FileWriter(plugins);
      const result = await writer.getTransformedLines(
        [
          new Line("key", "value"),
          new Line("// commentaire", null),
          new Line("key2", "value2"),
        ],
        androidTransformer,
        { language: "" }
      );

      expect(result).toEqual(
        '    <string name="key">value</string>' +
          EOL +
          "    <!-- commentaire -->" +
          EOL +
          '    <string name="key2">value2</string>'
      );
    });

    it("with ios transformer should return in format", async () => {
      const writer = new FileWriter(plugins);
      const result = await writer.getTransformedLines(
        [
          new Line("key", "value"),
          new Line("# commentaire", null),
          new Line("key2", "value2"),
        ],
        iosTransformer,
        { language: "" }
      );

      expect(result).toEqual(
        '"key" = "value";' + EOL + "// commentaire" + EOL + '"key2" = "value2";'
      );
    });
  });
});
