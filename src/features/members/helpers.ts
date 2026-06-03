import { decode } from "base64-arraybuffer";
import { Alert } from "react-native";
import { supabase } from "../../api/supabase";

type Asset = {
  base64?: string;
  uri?: string;
};

export async function uploadAvatarFromAsset(
  asset: Asset,
  profileId: string | undefined,
  updateAvatar: (url: string) => void,
  t: (k: string) => string,
) {
  if (!asset) return;

  try {
    const fileName = `${profileId || "user"}_${Date.now()}.jpg`;
    const filePath = `avatars/${fileName}`;

    let body: any;
    if ((asset as any).base64) {
      body = decode((asset as any).base64);
    } else {
      const response = await fetch((asset as any).uri);
      body = await response.blob();
    }

    const { error: uploadError } = await supabase.storage
      .from("avatars")
      .upload(filePath, body, {
        contentType: "image/jpeg",
        upsert: true,
      });

    if (uploadError) throw uploadError;

    const {
      data: { publicUrl },
    } = supabase.storage.from("avatars").getPublicUrl(filePath) as any;

    const { error: updateError } = await supabase
      .from("profiles")
      .update({ avatar_url: publicUrl })
      .eq("id", profileId);

    if (updateError) throw updateError;

    updateAvatar(publicUrl);
    Alert.alert(t("common.success"), t("messages.avatar_updated"));
  } catch (error: any) {
    Alert.alert(
      t("common.error"),
      error?.message || t("messages.upload_failed"),
    );
    throw error;
  }
}
