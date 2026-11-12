"use client";

import { createContext, useContext, useId, type ComponentProps, type ReactNode } from "react";
import { Check, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

interface RadioContextValue { value: number; name: string; onValueChange: (value: number) => void }
const RadioContext = createContext<RadioContextValue | null>(null);

export function PlayerMenu({ className, ...props }: ComponentProps<"div">) {
  return <div data-player-menu="" className={cn("absolute right-0 bottom-0 select-none overflow-hidden rounded-sm bg-neutral-500/60 text-sm text-white backdrop-blur-md", className)} {...props} />;
}

export function PlayerMenuItem({ className, children, checked = false, ...props }: ComponentProps<"button"> & { checked?: boolean }) {
  return (
    <button type="button" className={cn("relative flex h-[50px] w-full shrink-0 items-center justify-between gap-3 px-4 pr-12 text-left transition-colors hover:bg-white/20 active:bg-white/30 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-white/80", checked && "bg-white/20", className)} {...props}>
      {children}
      <ChevronRight aria-hidden="true" className={cn("absolute right-4 size-5 transition-transform duration-300", checked && "rotate-180")} />
    </button>
  );
}

export function PlayerMenuRadioGroup({ value, onValueChange, className, ...props }: Omit<ComponentProps<"div">, "onChange"> & { value: number; onValueChange: (value: number) => void }) {
  const name = useId();
  return (
    <RadioContext.Provider value={{ value, name, onValueChange }}>
      <div role="radiogroup" className={cn("min-h-0 select-none overflow-y-auto overscroll-contain", className)} {...props} />
    </RadioContext.Provider>
  );
}

export function PlayerMenuRadioItem({ value, children, className }: { value: number; children: ReactNode; className?: string }) {
  const group = useContext(RadioContext);
  if (!group) throw new Error("PlayerMenuRadioItem must be inside PlayerMenuRadioGroup");
  return (
    <label className={cn("relative flex h-[50px] w-full shrink-0 cursor-pointer items-center px-4 transition-colors hover:bg-white/20 active:bg-white/30 has-[input:focus-visible]:outline-2 has-[input:focus-visible]:-outline-offset-2 has-[input:focus-visible]:outline-white/80", className)}>
      <input type="radio" name={group.name} value={value} checked={group.value === value}
        onChange={(event) => group.onValueChange(Number(event.currentTarget.value))}
        className="peer absolute inset-0 m-0 size-full cursor-pointer appearance-none outline-none" />
      <span className="pointer-events-none">{children}</span>
      <Check aria-hidden="true" className="pointer-events-none absolute right-4 size-5 text-transparent peer-checked:text-white" />
    </label>
  );
}
