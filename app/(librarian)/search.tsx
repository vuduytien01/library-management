import React from "react";
import { SearchContent } from "../../src/components/shared/SearchContent";
import { useRouter } from "expo-router";

export default function LibrarianSearchPage() {
  const router = useRouter();

  return (
    <SearchContent 
      onBookPress={(book) => router.push("/(librarian)/books")}
      showBack={true}
    />
  );
}
