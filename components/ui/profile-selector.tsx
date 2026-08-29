import React from "react";
import { useState, useMemo, useEffect } from "react";
import { Profile } from "@/types";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Check, ChevronDown } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { cn } from "@/lib/utils";

type ProfileSelectorProps = {
  label: string;
  profiles: Profile[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  placeholder?: string;
};

const ProfileSelector: React.FC<ProfileSelectorProps> = ({
  label,
  profiles,
  selectedId,
  onSelect,
  placeholder = "Select...",
}) => {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");

  // Reset search when dropdown closes
  useEffect(() => {
    if (!open) {
      setSearch("");
    }
  }, [open]);

  // Create lookup map once
  const profilesMap = useMemo(() => {
    return Object.fromEntries(profiles.map((p) => [p.id, p]));
  }, [profiles]);

  // Filter profiles based on search term - fixed implementation
  const filteredProfiles = useMemo(() => {
    const searchTerm = search.toLowerCase().trim();

    // If no search term, return all profiles
    if (!searchTerm) return profiles;

    // Filter profiles with more robust checks
    return profiles.filter((profile) => {
      // Safely get normalized values
      const firstName = (profile.firstName || "").toLowerCase();
      const lastName = (profile.lastName || "").toLowerCase();
      const email = (profile.email || "").toLowerCase();
      const fullName = `${firstName} ${lastName}`.trim();

      // Check if any field matches the search term
      return (
        firstName.includes(searchTerm) ||
        lastName.includes(searchTerm) ||
        email.includes(searchTerm) ||
        fullName.includes(searchTerm)
      );
    });
  }, [profiles, search]);

  return (
    <div className="grid gap-1.5">
      <Label>{label}</Label>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            role="combobox"
            aria-expanded={open}
            className="w-full justify-between text-left"
          >
            <span className="truncate">
              {selectedId && profilesMap[selectedId]
                ? `${profilesMap[selectedId].firstName || ""} ${
                    profilesMap[selectedId].lastName || ""
                  }`.trim()
                : placeholder}
            </span>
            <ChevronDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[300px] p-0">
          <Command>
            <CommandInput
              placeholder={`Search ${label.toLowerCase()}...`}
              value={search}
              onValueChange={setSearch}
              className="h-9"
            />
            <CommandList>
              <CommandEmpty>No {label.toLowerCase()} found.</CommandEmpty>
              <CommandGroup className="max-h-[200px] overflow-auto">
                {filteredProfiles.map((profile) => (
                  <CommandItem
                    key={profile.id}
                    value={`${profile.firstName || ""} ${
                      profile.lastName || ""
                    } ${profile.email || ""}`.toLowerCase()}
                    onSelect={() => {
                      onSelect(profile.id);
                      setOpen(false);
                    }}
                  >
                    <Check
                      className={cn(
                        "mr-2 h-4 w-4",
                        selectedId === profile.id ? "opacity-100" : "opacity-0",
                      )}
                    />
                    <div>
                      <span>
                        {profile.firstName || ""} {profile.lastName || ""}
                      </span>
                      {profile.email && (
                        <span className="ml-2 text-xs text-muted-foreground">{profile.email}</span>
                      )}
                    </div>
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
    </div>
  );
};

export default ProfileSelector;
