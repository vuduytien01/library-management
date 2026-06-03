import React from "react";

export default function HumanLibraryRouteError() {
  React.useEffect(() => {
    try {
      document.title = "Human Library — Error";
    } catch (e) {
      // no-op for non-browser renderers
    }
  }, []);

  return (
    <main style={{ padding: 24 }}>
      <h1 style={{ color: "#b00020" }}>Route configuration error</h1>
      <p>
        This route is missing a default export compatible with the app router.
        Please open the console or check the server logs for more details.
      </p>
    </main>
  );
}

// Keep existing data functions available for imports elsewhere
export type HumanLibraryRole = "LIBRARIAN" | "ADMIN";

export interface HumanLibraryPerson {
  id: string;
  name: string;
  role: HumanLibraryRole;
  expertise: string;
  story: string;
  avatarUrl?: string | null;
}

type ProfileRow = {
  id: string;
  full_name: string | null;
  role: string | null;
  avatar_url: string | null;
};

const fallbackPeople: HumanLibraryPerson[] = [
  {
    id: "sample-alex-nguyen",
    name: "Alex Nguyen",
    role: "LIBRARIAN",
    expertise: "Storytelling, Migration",
    story:
      "Journalist who helps readers find the right story at the right time.",
  },
  {
    id: "sample-lan-tran",
    name: "Dr. Lan Tran",
    role: "ADMIN",
    expertise: "Local Memory, Community Archives",
    story: "Historian focused on preserving community knowledge and context.",
  },
];

const mapProfileToPerson = (profile: ProfileRow): HumanLibraryPerson => {
  const role = profile.role === "ADMIN" ? "ADMIN" : "LIBRARIAN";

  return {
    id: profile.id,
    name: profile.full_name?.trim() || "Unknown person",
    role,
    expertise:
      role === "ADMIN"
        ? "Operations, Stewardship"
        : "Storytelling, Collections",
    story:
      role === "ADMIN"
        ? "Helps shape the library from behind the scenes."
        : "Shares stories and curates meaningful connections.",
    avatarUrl: profile.avatar_url,
  };
};

// Exported helpers retained as before (no runtime side effects)
export const fetchHumanLibraryPeople = async () => {
  // Lazy import to avoid adding supabase dependency to route render surface
  try {
    const { isEnvValid, supabase } = await import("../../../src/api/supabase");
    if (!isEnvValid) {
      return fallbackPeople;
    }

    const { data, error } = await supabase
      .from("profiles")
      .select("id, full_name, role, avatar_url")
      .in("role", ["LIBRARIAN", "ADMIN"])
      .order("full_name", { ascending: true, nullsFirst: false });

    if (error) {
      console.warn(
        "[HumanLibrary] Falling back to sample people:",
        error.message,
      );
      return fallbackPeople;
    }

    const people = (data || []).map(mapProfileToPerson);
    return people.length > 0 ? people : fallbackPeople;
  } catch (e) {
    return fallbackPeople;
  }
};

export function useHumanLibraryPeople(): {
  data?: HumanLibraryPerson[];
  isLoading: boolean;
} {
  const [data, setData] = React.useState<HumanLibraryPerson[] | undefined>(
    undefined,
  );
  const [isLoading, setIsLoading] = React.useState(true);

  React.useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const people = await fetchHumanLibraryPeople();
        if (!mounted) return;
        setData(people);
      } catch (e) {
        if (!mounted) return;
        setData(fallbackPeople);
      } finally {
        if (!mounted) return;
        setIsLoading(false);
      }
    })();

    return () => {
      mounted = false;
    };
  }, []);

  return { data, isLoading };
}

export function useHumanLibraryPerson(id: string): {
  person?: HumanLibraryPerson | null;
  isLoading: boolean;
} {
  const [person, setPerson] = React.useState<
    HumanLibraryPerson | null | undefined
  >(undefined);
  const [isLoading, setIsLoading] = React.useState(true);

  React.useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const people = await fetchHumanLibraryPeople();
        if (!mounted) return;
        const found = people.find((p) => p.id === id) || null;
        setPerson(found);
      } catch (e) {
        if (!mounted) return;
        setPerson(null);
      } finally {
        if (!mounted) return;
        setIsLoading(false);
      }
    })();

    return () => {
      mounted = false;
    };
  }, [id]);

  return { person, isLoading };
}
