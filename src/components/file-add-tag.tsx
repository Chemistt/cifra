"use client";

import { X } from "lucide-react";
import * as React from "react";

import { Badge } from "@/components/ui/badge";
import {
  Command,
  CommandGroup,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Command as CommandPrimitive } from "cmdk";
import { useCallback } from "react";

type Tag = {
  value: string;
  label: string;
};

export default function FileAddTag() {
  const [open, setOpen] = React.useState(false);
  const [selected, setSelected] = React.useState<Tag[]>([]);
  const [inputValue, setInputValue] = React.useState("");

  const handleUnselect = useCallback((tag: Tag) => {
    setSelected((prev) => prev.filter((s) => s.value !== tag.value));
  }, []);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === "Backspace" && inputValue === "" && selected.length > 0) {
        setSelected((prev) => prev.slice(0, -1));
      } else if (e.key === "Enter" && inputValue.trim() !== "") {
        const trimmed = inputValue.trim();
        const exists = selected.some(
          (c) => c.label.toLowerCase() === trimmed.toLowerCase()
        );
        if (!exists) {
          setSelected((prev) => [
            ...prev,
            { value: trimmed.toLowerCase().replace(/\s+/g, "-"), label: trimmed },
          ]);
        }
        setInputValue("");
      }
    },
    [inputValue, selected]
  );

  return (
    <div className="w-full">
      <Command className="overflow-visible">
        <div className="rounded-md border border-input px-3 py-2 text-sm ring-offset-background focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2">
          <div className="flex flex-wrap gap-1">
            {selected.map((tag) => (
              <Badge
                key={tag.value}
                variant="secondary"
                className="select-none"
              >
                {tag.label}
                <X
                  className="size-3 text-muted-foreground hover:text-foreground ml-2 cursor-pointer"
                  onMouseDown={(e) => {
                    e.preventDefault();
                  }}
                  onClick={() => handleUnselect(tag)}
                />
              </Badge>
            ))}
            <CommandPrimitive.Input
              onKeyDown={handleKeyDown}
              onValueChange={setInputValue}
              value={inputValue}
              onBlur={() => setOpen(false)}
              onFocus={() => setOpen(true)}
              placeholder="Type and press Enter..."
              className="ml-2 flex-1 bg-transparent outline-none placeholder:text-muted-foreground"
            />
          </div>
        </div>
        <div className="relative mt-2">
          <CommandList>
            {open && inputValue.trim() !== "" && (
              <div className="absolute top-0 z-10 w-full rounded-md border bg-popover text-popover-foreground shadow-md outline-none">
                <CommandGroup>
                  {!selected.some(
                    (c) =>
                      c.label.toLowerCase() === inputValue.trim().toLowerCase()
                  ) && (
                    <CommandItem
                      className="cursor-pointer italic text-muted-foreground"
                      onMouseDown={(e) => e.preventDefault()}
                      onSelect={() => {
                        const trimmed = inputValue.trim();
                        setSelected((prev) => [
                          ...prev,
                          {
                            value: trimmed.toLowerCase().replace(/\s+/g, "-"),
                            label: trimmed,
                          },
                        ]);
                        setInputValue("");
                      }}
                    >
                      Add "{inputValue.trim()}"
                    </CommandItem>
                  )}
                </CommandGroup>
              </div>
            )}
          </CommandList>
        </div>
      </Command>
    </div>
  );
}
