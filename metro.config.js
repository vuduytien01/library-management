const path = require("path");
const os = require("os");

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

if (process.env.JEST_WORKER_ID) {
  module.exports = {
    resolver: {},
    resolveZustandWebModule,
  };
} else {
  const { getDefaultConfig } = require("expo/metro-config");
  const { withNativeWind } = require("nativewind/metro");

  const config = getDefaultConfig(__dirname);
  const existingResolveRequest = config.resolver.resolveRequest;
  const nodeMajor = Number(process.versions.node.split(".")[0]);

  config.maxWorkers = Math.min(config.maxWorkers || os.cpus().length || 2, 2);

  if (nodeMajor >= 24 || process.env.METRO_DISABLE_FILE_MAP_CACHE === "1") {
    config.watcher.unstable_autoSaveCache = {
      ...(config.watcher.unstable_autoSaveCache || {}),
      enabled: false,
    };

    config.unstable_fileMapCacheManagerFactory = () => ({
      read: async () => null,
      write: async () => {},
      end: async () => {},
    });
  }

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

  // Allow disabling NativeWind Metro interop via env var for debugging
  // Set DISABLE_NATIVEWIND_INTEROP=1 to bypass css-to-rn processing.
  module.exports =
    process.env.DISABLE_NATIVEWIND_INTEROP === "1"
      ? config
      : withNativeWind(config, { input: "./global.css" });

  module.exports.resolveZustandWebModule = resolveZustandWebModule;
}
