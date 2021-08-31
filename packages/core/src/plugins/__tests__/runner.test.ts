import Line from "../../line";
import jsonTransformer from "../../transformer/json";
import { PluginsRunner } from "../runner";

describe("PluginsRunner.runHook", () => {
  const logger = { warn: jest.fn(), log: jest.fn() };
  const meta = { language: "", transformer: jsonTransformer };

  beforeEach(() => {
    logger.warn.mockReset();
    logger.log.mockReset();
  });

  it("should run hook of each plugin", async () => {
    const plugin1 = {
      pluginName: "plugin1",
      transformLine: jest.fn(),
      transformFullOutput: jest.fn(),
      readTranslation: jest.fn(),
    };
    const plugin2 = {
      pluginName: "plugin2",
      transformLine: jest.fn(),
      transformFullOutput: jest.fn(),
      readTranslation: jest.fn(),
    };
    const plugin3 = {
      pluginName: "plugin3",
      transformLine: jest.fn(),
      transformFullOutput: jest.fn(),
      readTranslation: jest.fn(),
    };
    const target = {} as Line;

    const plugins = new PluginsRunner([plugin1, plugin2, plugin3], {
      logger,
    });
    await plugins.runHook("transformLine", target, meta);

    expect(plugin1.transformLine).toHaveBeenCalledTimes(1);
    expect(plugin1.transformFullOutput).not.toHaveBeenCalled();
    expect(plugin2.transformLine).toHaveBeenCalledTimes(1);
    expect(plugin2.transformFullOutput).not.toHaveBeenCalled();
    expect(plugin3.transformLine).toHaveBeenCalledTimes(1);
    expect(plugin3.transformFullOutput).not.toHaveBeenCalled();
  });

  it("should pass result of plugin to the next one", async () => {
    const plugin1 = {
      pluginName: "plugin1",
      transformLine: jest.fn(),
      transformFullOutput: jest.fn((output: string) => output + "1"),
      readTranslation: jest.fn(),
    };
    const plugin2 = {
      pluginName: "plugin2",
      transformLine: jest.fn(),
      transformFullOutput: jest.fn((output: string) => output + "2"),
      readTranslation: jest.fn(),
    };
    const plugin3 = {
      pluginName: "plugin3",
      transformLine: jest.fn(),
      transformFullOutput: jest.fn((output: string) => output + "3"),
      readTranslation: jest.fn(),
    };

    const plugins = new PluginsRunner([plugin1, plugin2, plugin3], {
      logger,
    });
    const result = await plugins.runHook("transformFullOutput", "", meta);

    expect(plugin1.transformFullOutput).toHaveBeenCalledWith("", meta);
    expect(plugin2.transformFullOutput).toHaveBeenCalledWith("1", meta);
    expect(plugin3.transformFullOutput).toHaveBeenCalledWith("12", meta);
    expect(result).toBe("123");
  });

  it("should return original result if error occur during hook execution", async () => {
    const plugin1 = {
      pluginName: "plugin1",
      transformLine: jest.fn(),
      transformFullOutput: jest.fn((output: string) => {
        throw new Error("Something happened");
        return output + "1";
      }),
      readTranslation: jest.fn(),
    };
    const plugin2 = {
      pluginName: "plugin2",
      transformLine: jest.fn(),
      transformFullOutput: jest.fn((output: string) => output + "2"),
      readTranslation: jest.fn(),
    };

    const plugins = new PluginsRunner([plugin1, plugin2], {
      logger,
    });
    const result = await plugins.runHook("transformFullOutput", "", meta);

    expect(plugin1.transformFullOutput).toHaveBeenCalledWith("", meta);
    expect(plugin2.transformFullOutput).toHaveBeenCalledWith("", meta);
    expect(result).toBe("2");
    expect(logger.warn).toHaveBeenCalledTimes(1);
  });
});
