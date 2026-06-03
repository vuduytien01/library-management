describe("metro web resolver compatibility", () => {
  it("maps zustand to CJS file on web to avoid import.meta parse errors", () => {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const metroConfig = require("../../metro.config.js");

    expect(typeof metroConfig.resolveZustandWebModule).toBe("function");

    const resolved = metroConfig.resolveZustandWebModule("zustand", "web");

    expect(resolved).toContain("node_modules");
    expect(resolved).toContain("zustand");
    expect(resolved).toMatch(/index\.js$/);
  });

  it("does not rewrite zustand on native platforms", () => {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const metroConfig = require("../../metro.config.js");

    const resolved = metroConfig.resolveZustandWebModule("zustand", "ios");

    expect(resolved).toBeNull();
  });
});
