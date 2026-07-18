import { useState, useMemo } from "react";
import { Profile } from "@/types";

interface UseSelectionOptions {
  onSelect?: (id: string, profile: Profile) => void;
  initialSelectedId?: string;
}

export interface SelectionState {
  open: boolean;
  selectedId: string;
  search: string;
  list: Profile[];
  filteredList: Profile[];
  selectedProfile: Profile | undefined;
  setOpen: (value: boolean) => void;
  setSelectedId: (id: string) => void;
  setSearch: (search: string) => void;
  handleSelect: (profile: Profile) => void;
  reset: () => void;
}

export function useSelection(
  profiles: Profile[],
  options: UseSelectionOptions = {},
): SelectionState {
  const { onSelect, initialSelectedId = "" } = options;

  const [open, setOpen] = useState(false);
  const [selectedId, setSelectedId] = useState(initialSelectedId);
  const [search, setSearch] = useState("");

  const filteredList = useMemo(() => {
    if (!search) return profiles;

    const searchLower = search.toLowerCase();
    return profiles.filter((profile) => {
      const fullName = `${profile.firstName} ${profile.lastName}`.toLowerCase();
      const email = profile.email.toLowerCase();
      return fullName.includes(searchLower) || email.includes(searchLower);
    });
  }, [profiles, search]);

  const selectedProfile = useMemo(() => {
    return profiles.find((profile) => profile.id === selectedId);
  }, [profiles, selectedId]);

  const handleSelect = (profile: Profile) => {
    setSelectedId(profile.id);
    setOpen(false);
    setSearch("");
    onSelect?.(profile.id, profile);
  };

  const reset = () => {
    setSelectedId(initialSelectedId);
    setSearch("");
    setOpen(false);
  };

  return {
    open,
    selectedId,
    search,
    list: profiles,
    filteredList,
    selectedProfile,
    setOpen,
    setSelectedId,
    setSearch,
    handleSelect,
    reset,
  };
}
