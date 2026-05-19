import React from "react";
import { SearchContent } from "../../src/components/shared/SearchContent";
import { useRouter } from "expo-router";

export default function AdminSearchPage() {
  const router = useRouter();

  return (
    <SearchContent 
      onBookPress={(book) => router.push("/(admin)/inventory")}
      showBack={true}
    />
  );
}
