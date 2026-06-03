import { supabase } from "../api/supabase";
import { adminService } from "../../src/features/admin/admin.service";

describe("adminService", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("maps combined profile/auth lock status returned by admin-manager", async () => {
    (supabase.functions.invoke as jest.Mock).mockResolvedValueOnce({
      data: {
        user: {
          id: "user-1",
          full_name: "Google User",
          avatar_url: null,
          is_locked: false,
          profile_is_locked: false,
          auth_banned_until: null,
          auth_is_banned: false,
        },
      },
      error: null,
    });

    const user = await adminService.updateUser("user-1", { isLocked: false });

    expect(supabase.functions.invoke).toHaveBeenCalledWith(
      "admin-manager/update-user",
      {
        method: "PUT",
        body: {
          id: "user-1",
          fullName: undefined,
          role: undefined,
          isLocked: false,
        },
      },
    );
    expect(user).toEqual(
      expect.objectContaining({
        id: "user-1",
        fullName: "Google User",
        isLocked: false,
        profileIsLocked: false,
        authBannedUntil: null,
        authIsBanned: false,
      }),
    );
  });
});
