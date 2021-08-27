import * as prettier from "prettier";

import { createPlugin, OutputFormat } from "@lokse/core";
import type {
  GeneralPluginOptions,
  LoksePlugin,
  TransformFullOutputMeta,
} from "@lokse/core";

export default function (options: GeneralPluginOptions): LoksePlugin {
  async function format(output: string, parser: string) {
    const prettierConfig = await prettier.resolveConfigFile();

    if (!prettierConfig) {
      return output;
    }

    const prettierOptions = await prettier.resolveConfig(prettierConfig, {
      editorconfig: true,
    });

    if (prettierOptions === null) {
      return output;
    }

    try {
      return prettier.format(output, { parser, ...prettierOptions });
    } catch (error) {
      options.logger.log("Error when formatting the output", error);
      return output;
    }
  }

  return createPlugin({
    transformFullOutput: async (
      output: string,
      meta: TransformFullOutputMeta
    ) => {
      if (meta.transformer.outputFormat === OutputFormat.JSON) {
        const formatted = await format(output, "json");

        return formatted;
      }

      return output;
    },
  });
}
