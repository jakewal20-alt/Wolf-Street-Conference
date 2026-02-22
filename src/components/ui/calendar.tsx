import * as React from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { DayPicker } from "react-day-picker";

import { cn } from "@/lib/utils";
import { buttonVariants } from "@/components/ui/button";

export type CalendarProps = React.ComponentProps<typeof DayPicker> & {
  eventDates?: Date[];
};

function Calendar({ 
  className, 
  classNames, 
  showOutsideDays = true, 
  eventDates = [],
  ...props 
}: CalendarProps) {
  // Create a set of date strings for quick lookup
  const eventDateStrings = React.useMemo(() => 
    new Set(eventDates.map(d => d.toDateString())),
    [eventDates]
  );

  return (
    <DayPicker
      showOutsideDays={showOutsideDays}
      className={cn("p-3 pointer-events-auto select-none", className)}
      classNames={{
        months: "flex flex-col sm:flex-row space-y-4 sm:space-x-4 sm:space-y-0",
        month: "space-y-4",
        caption: "flex justify-center pt-1 relative items-center h-10",
        caption_label: "text-sm font-semibold tracking-wide",
        nav: "space-x-1 flex items-center",
        nav_button: cn(
          buttonVariants({ variant: "ghost" }),
          "h-8 w-8 bg-transparent p-0 hover:bg-accent/80 transition-all duration-200 rounded-full",
          "hover:scale-110 active:scale-95"
        ),
        nav_button_previous: "absolute left-1",
        nav_button_next: "absolute right-1",
        table: "w-full border-collapse",
        head_row: "flex mb-1",
        head_cell: "text-muted-foreground/70 rounded-md w-9 font-medium text-[0.7rem] uppercase tracking-wider",
        row: "flex w-full mt-1",
        cell: cn(
          "relative h-9 w-9 text-center text-sm p-0",
          "focus-within:relative focus-within:z-20",
          "[&:has([aria-selected].day-range-end)]:rounded-r-md",
          "[&:has([aria-selected].day-outside)]:bg-accent/50",
          "[&:has([aria-selected])]:bg-accent",
          "first:[&:has([aria-selected])]:rounded-l-md",
          "last:[&:has([aria-selected])]:rounded-r-md"
        ),
        day: cn(
          buttonVariants({ variant: "ghost" }),
          "h-9 w-9 p-0 font-normal aria-selected:opacity-100",
          "transition-all duration-200 ease-out",
          "hover:bg-accent/60 hover:scale-110 hover:shadow-sm hover:z-10",
          "active:scale-95",
          "rounded-lg"
        ),
        day_range_end: "day-range-end",
        day_selected: cn(
          "bg-primary text-primary-foreground",
          "hover:bg-primary/90 hover:text-primary-foreground",
          "focus:bg-primary focus:text-primary-foreground",
          "shadow-md ring-2 ring-primary/30 ring-offset-2 ring-offset-background",
          "scale-105"
        ),
        day_today: cn(
          "bg-accent text-accent-foreground font-bold",
          "ring-2 ring-primary/40 ring-inset"
        ),
        day_outside: cn(
          "day-outside text-muted-foreground/40",
          "aria-selected:bg-accent/50 aria-selected:text-muted-foreground aria-selected:opacity-30",
          "hover:text-muted-foreground/60"
        ),
        day_disabled: "text-muted-foreground/30 cursor-not-allowed hover:bg-transparent hover:scale-100",
        day_range_middle: "aria-selected:bg-accent aria-selected:text-accent-foreground",
        day_hidden: "invisible",
        ...classNames,
      }}
      components={{
        IconLeft: ({ ..._props }) => (
          <ChevronLeft className="h-4 w-4 transition-transform group-hover:-translate-x-0.5" />
        ),
        IconRight: ({ ..._props }) => (
          <ChevronRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
        ),
        DayContent: ({ date, ...props }) => {
          const hasEvents = eventDateStrings.has(date.toDateString());
          return (
            <div className="relative w-full h-full flex items-center justify-center">
              <span>{date.getDate()}</span>
              {hasEvents && (
                <span className="absolute bottom-0.5 left-1/2 -translate-x-1/2 flex gap-0.5">
                  <span className="w-1 h-1 rounded-full bg-primary animate-pulse" />
                </span>
              )}
            </div>
          );
        },
      }}
      {...props}
    />
  );
}
Calendar.displayName = "Calendar";

export { Calendar };
