// "use client";

// import * as React from "react"
// import {Check, ChevronsUpDown } from "lucide-react"

// import { cn } from "@/lib/utils"
// import { Button } from "@/components/ui/button"
// import {
//     Command,
//     CommandEmpty,
//     CommandGroup,
//     CommandInput,
//     CommandItem,
//     CommandList,
// } from "@/components/ui/command"

// import {
//     Popover,
//     PopoverContent,
//     PopoverTrigger,
// } from "@/components/ui/popover"

import * as React from "react";
import { Check } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Separator } from "@/components/ui/separator";
import { ChevronsUpDown, SquareMinus } from "lucide-react";

interface SearchableSelectProps {
  list: { value: string; label: string }[];
  category: string;
  onValueChange?: (value: string) => void;
  defaultValue?: string;
}

export function Combobox({
  list,
  category,
  onValueChange,
  defaultValue = "",
}: SearchableSelectProps) {
  const [open, setOpen] = React.useState(false);
  const [value, setValue] = React.useState<string>(defaultValue);
  const [selectedLabel, setSelectedLabel] = React.useState(
    defaultValue ? list.find((item) => item.value === defaultValue)?.label || "" : "",
  );

  const handleSelect = (selectedItem: { value: string; label: string } | null) => {
    if (selectedItem) {
      setValue(selectedItem.value);
      setSelectedLabel(selectedItem.label);
      setOpen(false);

      // Call the onValueChange callback if provided
      if (onValueChange) {
        onValueChange(selectedItem.value);
      }
    } else {
      setValue(defaultValue);
      setSelectedLabel(defaultValue);
      setSearchTerm("");
      if (onValueChange) {
        onValueChange("");
      }
    }
  };

  const [searchTerm, setSearchTerm] = React.useState("");

  const filteredList = React.useMemo(() => {
    return list.filter((item) => item.label.toLowerCase().includes(searchTerm.toLowerCase()));
  }, [list, searchTerm]);

  const handleValueChange = (newValue: string) => {
    setValue(newValue);
    if (onValueChange) {
      onValueChange(newValue);
    }
  };

  const shouldShowList = searchTerm.length > 0;

  return (
    // <Select value={value} onValueChange={handleValueChange}>
    <Command>
      <CommandInput
        placeholder={`Search ${category}...`}
        value={searchTerm}
        onValueChange={setSearchTerm}
      />
      {shouldShowList && (
        <>
          {" "}
          <CommandList className="h-[200px]">
            <CommandEmpty>No {category} found.</CommandEmpty>
            <CommandGroup>
              {list.map((item) => (
                <CommandItem
                  key={item.value}
                  value={item.label}
                  onSelect={() => handleSelect(item)}
                  className={cn(selectedLabel === item.label ? "bg-blue-400/10 text-blue-500" : "")}
                >
                  {item.label}
                  <Check
                    className={cn(
                      "ml-auto",
                      selectedLabel === item.label ? "opacity-100" : "opacity-0",
                    )}
                  />
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </>
      )}

      {selectedLabel && (
        <>
          <Separator />
          <CommandList onClick={() => handleSelect(null)}>
            <CommandItem>
              <span className="font-medium py-1">Clear Selection</span>
              <SquareMinus />
            </CommandItem>
          </CommandList>
        </>
      )}
    </Command>
    // </Select>
  );
}
// "use client";

// import * as React from "react"
// import {Check, ChevronsUpDown } from "lucide-react"

// import { cn } from "@/lib/utils"
// import { Button } from "@/components/ui/button"
// import {
//     Command,
//     CommandEmpty,
//     CommandGroup,
//     CommandInput,
//     CommandItem,
//     CommandList,
// } from "@/components/ui/command"

// import {
//     Popover,
//     PopoverContent,
//     PopoverTrigger,
// } from "@/components/ui/popover"
