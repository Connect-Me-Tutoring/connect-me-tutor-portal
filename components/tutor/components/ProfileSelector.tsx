import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { SelectionState } from "@/components/tutor/hooks/useSelection";
import { Check, ChevronDown } from "lucide-react";
import { Profile } from "@/types";

interface ProfileSelectorProps {
  openOptions: boolean;
  selectedUserId: string;
  usersMap: Record<string, Profile>;
  userSearch: string;
  users: Profile[];
  setOpenUserOptions: (value: boolean) => void;
  setSelectedUserId: (value: string) => string;
  setUserSearch: (value: string) => void;
}

export const ProfileSelector = ({
  openOptions,
  selectedUserId,
  usersMap,
  userSearch,
  users,
  setOpenUserOptions,
  setSelectedUserId,
  setUserSearch,
}: ProfileSelectorProps) => {
  return (
    <div className="grid grid-cols-4 items-center gap-4">
      {" "}
      <Label htmlFor="tutor" className="text-right">
        Student
      </Label>
      <Popover open={openOptions} onOpenChange={setOpenUserOptions}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            role="combobox"
            aria-expanded={openOptions}
            className="col-span-3"
          >
            {selectedUserId && usersMap[selectedUserId]
              ? `${usersMap[selectedUserId].firstName} ${usersMap[selectedUserId].lastName}`
              : "Select a student"}
            <ChevronDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="">
          <Command>
            <CommandInput
              placeholder="Search student..."
              value={userSearch}
              onValueChange={setUserSearch}
            />
            <CommandList>
              <CommandEmpty>No student found.</CommandEmpty>
              <CommandGroup>
                {users.map((user) => (
                  <CommandItem
                    key={user.id}
                    value={user.id}
                    keywords={[user.firstName, user.lastName, user.email]}
                    onSelect={() => {
                      setSelectedUserId(user.id);
                      setOpenUserOptions(false);
                    }}
                  >
                    <Check
                      className={cn(
                        "mr-2 h-4 w-4",
                        selectedUserId === user.id ? "opacity-100" : "opacity-0",
                      )}
                    />
                    {user.firstName} {user.lastName} - {user.email}
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
