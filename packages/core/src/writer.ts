import { EOL } from "os";
import { promisifyAll } from "bluebird";
import * as path from "path";
import * as mkdirp from "mkdirp";

import Transformer from "./transformer";
import Line from "./line";
import { PluginsRunner } from "./plugins";
import type { TransformLineMeta } from "./plugins";

const fs = promisifyAll(require("fs"));

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
    encoding = "utf8"
  ) {
    let fileContent = "";
    const { language, domain, outputDir } = fileInfo;
    const fileName = transformer.getFileName(language, domain);
    const filePath = path.resolve(outputDir, fileName);

    try {
      await fs.accessAsync(filePath, fs.F_OK);
      fileContent = await fs.readFileAsync(filePath, encoding);

      fileContent = fileContent.toString();
    } catch {
      // file doesnt exist yet
    }

    const valueToInsert = await this.getTransformedLines(lines, transformer, {
      language,
      domain,
    });

    let output = await transformer.insert(fileContent, valueToInsert);
    output = await this.plugins.runHook("transformFullOutput", output, {
      transformer,
      language,
      domain,
    });

    const dirname = path.dirname(filePath);
    await mkdirp(dirname);
    await fs.writeFileAsync(filePath, output, encoding);

    return fileName;
  }

  async getTransformedLines(
    lines: Line[],
    transformer: Transformer,
    meta: TransformLineMeta
  ) {
    let valueToInsert = "";

    const plurals: { [pluralKey: string]: Line[] } = {};

    for (let i = 0; i < lines.length; i++) {
      const unprocessedLine = lines[i];
      const isLastLine = i === lines.length - 1;

      if (unprocessedLine.isEmpty()) {
        continue;
      }

      // eslint-disable-next-line no-await-in-loop
      const line = await this.plugins.runHook(
        "transformLine",
        unprocessedLine,
        meta
      );

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

      if (
        !line.isPlural() &&
        (!isLastLine || Object.keys(plurals).length > 0)
      ) {
        valueToInsert += EOL;
      }
    }

    valueToInsert += Object.entries(plurals)
      .map(([key, plural]) => {
        if (typeof transformer.transformPluralsValues === "function") {
          return transformer.transformPluralsValues(key, plural);
        }
        return "";
      })
      .join(EOL);

    return valueToInsert;
  }
}

export default FileWriter;
