import {
  getHomeRouteForProfile,
  getRouteGroupForProfile,
} from "../../src/auth/roleRedirect";

describe("role redirect", () => {
  it("routes super admins to the admin group even when their role is member", () => {
    const profile = { role: "MEMBER" as const, is_super_admin: true };

    expect(getRouteGroupForProfile(profile)).toBe("(admin)");
    expect(getHomeRouteForProfile(profile)).toBe("/(admin)");
  });

  it("keeps normal members in the member group", () => {
    const profile = { role: "MEMBER" as const, is_super_admin: false };

    expect(getRouteGroupForProfile(profile)).toBe("(member)");
    expect(getHomeRouteForProfile(profile)).toBe("/(member)");
  });
});
