import { EOL } from "os";

interface Transformer {
  transformComment: null;
  transformKeyValue: null;
  /* merge newValues dans input selon la convention de la plateforme (utilisation d'un commentaire pour séparer ce qui est généré */
  insert(input, newValues): string;
}

const iOSTransformer = {
  transformComment(comment) {
    return "// " + comment;
  },
  transformKeyValue(key, value) {
    let normalizedValue = value.replace(/%newline%/gi, "\\n");
    normalizedValue = normalizedValue.replace(/"/gi, '\\"');
    normalizedValue = normalizedValue.replace(/%([@df])/gi, "%$1");
    normalizedValue = normalizedValue.replace(/%s/gi, "%@");

    return '"' + key + '" = "' + normalizedValue + '";';
  },
  AUTOGENERATED_TAG: "// AUTO-GENERATED",
  insert(input, newValues) {
    if (!input) {
      input = "";
    }

    const generatedIndex = input.indexOf(iOSTransformer.AUTOGENERATED_TAG);
    if (generatedIndex >= 0) {
      input = input.substr(0, generatedIndex);
    }

    const output = input + iOSTransformer.AUTOGENERATED_TAG + EOL + newValues;

    return output;
  },
};

const androidTransformer = {
  transformComment(comment) {
    return "    <!-- " + comment + " -->";
  },
  transformKeyValue(key, value) {
    let normalizedValue = value.replace(/%newline%/gi, "\\n");
    normalizedValue = normalizedValue.replace(/'/gi, "\\'");
    normalizedValue = normalizedValue.replace(/%([sdf])/gi, "%#$$$1");
    normalizedValue = normalizedValue.replace(/&/gi, "&amp;");
    normalizedValue = normalizedValue.replace(/\u00A0/gi, "\\u00A0");
    normalizedValue = normalizedValue.replace(
      /([^\.]|^)(\.{3})([^\.]|$)/gi,
      "$1&#8230;$3"
    );

    let ouput =
      '    <string name="' + key + '">' + normalizedValue + "</string>";

    let currPos = 0;
    let nbOcc = 1;
    const newStr = "";
    while ((currPos = ouput.indexOf("%#$", currPos)) != -1) {
      ouput = setCharAt(ouput, currPos + 1, nbOcc);
      ++currPos;
      ++nbOcc;
    }

    return ouput;
  },
  transformPluralsValues(key, values) {
    let ouput = '    <plurals name="' + key + '">' + EOL;

    for (let i = 0; i < values.length; i++) {
      let normalizedValue = values[i].getValue().replace(/%newline%/gi, "\\n");
      normalizedValue = normalizedValue.replace(/'/gi, "\\'");
      normalizedValue = normalizedValue.replace(/%([sdf])/gi, "%#$$$1");
      normalizedValue = normalizedValue.replace(/&/gi, "&amp;");
      normalizedValue = normalizedValue.replace(/\u00A0/gi, "\\u00A0");
      normalizedValue = normalizedValue.replace(
        /([^\.]|^)(\.{3})([^\.]|$)/gi,
        "$1&#8230;$3"
      );

      ouput +=
        '        <item quantity="' +
        values[i].getPluralKey() +
        '">' +
        normalizedValue +
        "</item>" +
        EOL;

      let currPos = 0;
      let nbOcc = 1;
      const newStr = "";
      while ((currPos = ouput.indexOf("%#$", currPos)) != -1) {
        ouput = setCharAt(ouput, currPos + 1, nbOcc);
        ++currPos;
        ++nbOcc;
      }
    }

    ouput += "    </plurals>";

    return ouput;
  },
  AUTOGENERATED_TAG: "    <!-- AUTO-GENERATED -->",
  insert(input, newValues) {
    const AUTOGENERATED_TAG = androidTransformer.AUTOGENERATED_TAG;

    if (!input) {
      input = "";
    }

    let output = "";
    const closeTagIndex = input.indexOf("</resources>");
    if (closeTagIndex < 0) {
      output =
        '<?xml version="1.0" encoding="utf-8"?>' + EOL + "<resources>" + EOL;
    } else {
      const autoGeneratedIndex = input.indexOf(AUTOGENERATED_TAG);
      if (autoGeneratedIndex >= 0) {
        output = input.substr(0, autoGeneratedIndex);
      } else {
        output = input.substr(0, closeTagIndex);
      }
    }

    output += AUTOGENERATED_TAG + EOL + newValues + EOL + "</resources>";

    return output;
  },
};

const jsonTransformer = {
  transformComment(comment) {
    return "";
  },
  transformKeyValue(key, value) {
    let normalizedValue = value.replace(/%newline%/gi, "\\n");
    normalizedValue = normalizedValue.replace(/"/gi, '\\"');
    normalizedValue = normalizedValue.replace(/%([@df])/gi, "%$1");
    normalizedValue = normalizedValue.replace(/%s/gi, "%@");

    return '  "' + key + '" : "' + normalizedValue + '",';
  },
  // AUTOGENERATED_TAG: '',
  insert(input, newValues, options) {
    newValues = newValues.substring(0, newValues.length - 1);

    const output = EOL + "{" + EOL + newValues + EOL + "}";

    return output;
  },
};

const dartTransformer = {
  transformComment(comment) {
    return "  // " + comment;
  },
  transformKeyValue(key, value) {
    let normalizedValue = value.replace(/%newline%/gi, "\\n");
    normalizedValue = normalizedValue.replace(/"/gi, '\\"');
    normalizedValue = normalizedValue.replace(/%([@df])/gi, "%$1");
    normalizedValue = normalizedValue.replace(/%s/gi, "%@");

    return '  "' + key + '" : "' + normalizedValue + '",';
  },
  AUTOGENERATED_TAG: "// AUTO-GENERATED",
  insert(input, newValues, options) {
    if (!input) {
      input = "";
    }

    const generatedIndex = input.indexOf(dartTransformer.AUTOGENERATED_TAG);
    if (generatedIndex >= 0) {
      input = input.substr(0, generatedIndex);
    }

    const header = options && options.header ? options.header : "";
    const footer = options && options.footer ? options.footer : "";

    const output =
      input +
      dartTransformer.AUTOGENERATED_TAG +
      EOL +
      header +
      "{" +
      EOL +
      newValues +
      EOL +
      "};" +
      footer;

    return output;
  },
};

const dartTemplateTransformer = {
  transformComment(comment) {
    return "  // " + comment;
  },
  transformKeyValue(key, value) {
    let normalizedValue = value.replace(/%newline%/gi, "\\n");
    normalizedValue = normalizedValue.replace(/"/gi, '\\"');
    normalizedValue = normalizedValue.replace(/%([@df])/gi, "%$1");
    normalizedValue = normalizedValue.replace(/%s/gi, "%@");

    return "  String get " + key + ' => get("' + key + '");';
  },
  AUTOGENERATED_TAG: "// AUTO-GENERATED",
  insert(input, newValues, options) {
    if (!input) {
      input = "";
    }

    const generatedIndex = input.indexOf(
      dartTemplateTransformer.AUTOGENERATED_TAG
    );
    if (generatedIndex >= 0) {
      input = input.substr(0, generatedIndex);
    }

    const className = options && options.className ? options.className : "T";
    const header =
      options && options.header ? options.header : "library core.t";
    const baseClass =
      options && options.baseClass ? options.baseClass : "TranslationSet";

    const output =
      input +
      dartTemplateTransformer.AUTOGENERATED_TAG +
      EOL +
      header +
      EOL +
      EOL +
      "class " +
      className +
      " extends " +
      baseClass +
      " { " +
      EOL +
      EOL +
      "  " +
      className +
      "(values): super(values);" +
      EOL +
      EOL +
      newValues +
      EOL +
      "}";

    return output;
  },
};

// TODO: finish + testing
const dotNetTransformer = {
  transformComment(comment) {
    return androidTransformer.transformComment(comment);
  },

  transformKeyValue(key, value) {
    // TODO: normalize string + detect format (%s => {0})

    const output =
      '<data name="' +
      key +
      '" xml:space="preserve">' +
      EOL +
      "   <value>" +
      value +
      "</value>" +
      EOL +
      "</data>" +
      EOL;
  },
  AUTOGENERATED_TAG: "<!-- AUTO-GENERATED -->",
  insert(input, newValues) {
    // TODO: use auto-generated tag
    return dotNetHeader + EOL + newValues + "</root>";
  },
};

function setCharAt(str, index, chr) {
  if (index > str.length - 1) return str;
  return str.substr(0, index) + chr + str.substr(index + 1);
}

export default {
  ios: iOSTransformer,
  android: androidTransformer,
  web: jsonTransformer,
  dart: dartTransformer,
  dartTemplate: dartTemplateTransformer,
  ".net": dotNetTransformer,
};

const dotNetHeader =
  '<?xml version="1.0" encoding="utf-8"?>' +
  "<root>" +
  '  <xsd:schema id="root" xmlns="" xmlns:xsd="http://www.w3.org/2001/XMLSchema" xmlns:msdata="urn:schemas-microsoft-com:xml-msdata">' +
  '    <xsd:import namespace="http://www.w3.org/XML/1998/namespace" />' +
  '    <xsd:element name="root" msdata:IsDataSet="true">' +
  "      <xsd:complexType>" +
  '        <xsd:choice maxOccurs="unbounded">' +
  '          <xsd:element name="metadata">' +
  "            <xsd:complexType>" +
  "              <xsd:sequence>" +
  '                <xsd:element name="value" type="xsd:string" minOccurs="0" />' +
  "              </xsd:sequence>" +
  '              <xsd:attribute name="name" use="required" type="xsd:string" />' +
  '              <xsd:attribute name="type" type="xsd:string" />' +
  '              <xsd:attribute name="mimetype" type="xsd:string" />' +
  '              <xsd:attribute ref="xml:space" />' +
  "            </xsd:complexType>" +
  "          </xsd:element>" +
  '          <xsd:element name="assembly">' +
  "            <xsd:complexType>" +
  '              <xsd:attribute name="alias" type="xsd:string" />' +
  '              <xsd:attribute name="name" type="xsd:string" />' +
  "            </xsd:complexType>" +
  "          </xsd:element>" +
  '          <xsd:element name="data">' +
  "            <xsd:complexType>" +
  "              <xsd:sequence>" +
  '                <xsd:element name="value" type="xsd:string" minOccurs="0" msdata:Ordinal="1" />' +
  '                <xsd:element name="comment" type="xsd:string" minOccurs="0" msdata:Ordinal="2" />' +
  "              </xsd:sequence>" +
  '              <xsd:attribute name="name" type="xsd:string" use="required" msdata:Ordinal="1" />' +
  '              <xsd:attribute name="type" type="xsd:string" msdata:Ordinal="3" />' +
  '              <xsd:attribute name="mimetype" type="xsd:string" msdata:Ordinal="4" />' +
  '              <xsd:attribute ref="xml:space" />' +
  "            </xsd:complexType>" +
  "          </xsd:element>" +
  '          <xsd:element name="resheader">' +
  "            <xsd:complexType>" +
  "              <xsd:sequence>" +
  '                <xsd:element name="value" type="xsd:string" minOccurs="0" msdata:Ordinal="1" />' +
  "              </xsd:sequence>" +
  '              <xsd:attribute name="name" type="xsd:string" use="required" />' +
  "            </xsd:complexType>" +
  "          </xsd:element>" +
  "        </xsd:choice>" +
  "      </xsd:complexType>" +
  "    </xsd:element>" +
  "  </xsd:schema>" +
  '  <resheader name="resmimetype">' +
  "    <value>text/microsoft-resx</value>" +
  "  </resheader>" +
  '  <resheader name="version">' +
  "    <value>2.0</value>" +
  "  </resheader>" +
  '  <resheader name="reader">' +
  "    <value>System.Resources.ResXResourceReader, System.Windows.Forms, Version=4.0.0.0, Culture=neutral, PublicKeyToken=b77a5c561934e089</value>" +
  "  </resheader>" +
  '  <resheader name="writer">' +
  "    <value>System.Resources.ResXResourceWriter, System.Windows.Forms, Version=4.0.0.0, Culture=neutral, PublicKeyToken=b77a5c561934e089</value>" +
  "  </resheader>";
