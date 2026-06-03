const { getDefaultConfig } = require("expo/metro-config");
const { withNativeWind } = require("nativewind/metro");
const path = require("path");

const config = getDefaultConfig(__dirname);

function resolveZustandWebModule(moduleName, platform) {
  if (platform !== "web") return null;

  const zustandWebMap = {
    zustand: "index.js",
    "zustand/vanilla": "vanilla.js",
    "zustand/middleware": "middleware.js",
    "zustand/middleware/immer": "middleware/immer.js",
    "zustand/shallow": "shallow.js",
    "zustand/vanilla/shallow": "vanilla/shallow.js",
    "zustand/react/shallow": "react/shallow.js",
    "zustand/traditional": "traditional.js",
    "zustand/context": "context.js",
  };

  const mappedFile = zustandWebMap[moduleName];
  if (!mappedFile) return null;

  return path.join(__dirname, "node_modules", "zustand", mappedFile);
}

const existingResolveRequest = config.resolver.resolveRequest;

config.resolver.resolveRequest = (context, moduleName, platform) => {
  const forcedPath = resolveZustandWebModule(moduleName, platform);

  if (forcedPath) {
    return {
      type: "sourceFile",
      filePath: forcedPath,
    };
  }

  if (existingResolveRequest) {
    return existingResolveRequest(context, moduleName, platform);
  }

  return context.resolveRequest(context, moduleName, platform);
};
const finalConfig = withNativeWind(config, { input: "./global.css" });
finalConfig.resolveZustandWebModule = resolveZustandWebModule;

module.exports = finalConfig;
