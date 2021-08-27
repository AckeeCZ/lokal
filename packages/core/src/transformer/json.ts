import { EOL } from "os";
import { OutputFormat } from "../constants";
import { Transformer } from "./transformer";

const jsonTransformer: Transformer = {
  outputFormat: OutputFormat.JSON,
  transformComment() {
    return "";
  },
  transformKeyValue(key, value) {
    const normalizedValue = value
      .replace(/(\r\n|\n|\r)/gm, "") // Remove new lines inside string, https://www.textfixer.com/tutorials/javascript-line-breaks.php
      .replace(/%newline%/gi, "\\n")
      .replace(/"/gi, '\\"') // Escape double quotes
      .replace(/%([@df])/gi, "%$1")
      .replace(/%s/gi, "%@");

    return `  "${key}" : "${normalizedValue}",`;
  },
  async insert(_, newValues) {
    newValues = newValues.substring(0, newValues.length - 1);

    return `${EOL}{${EOL}${newValues}${EOL}}`;
  },

  getFileName(lang, domain) {
    return [domain, lang, "json"]
      .filter(Boolean)
      .map((s) => s!.toLowerCase())
      .join(".");
  },

  supportsSplit: true,
};

export default jsonTransformer;
