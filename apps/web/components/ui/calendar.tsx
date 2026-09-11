"use client"

import * as React from "react"
import { ChevronLeft, ChevronRight, ChevronDown, ChevronUp } from "lucide-react"
import { DayPicker, type DayPickerProps } from "react-day-picker"

import { cn } from "@/lib/utils"
import { buttonVariants } from "@/components/ui/button"

export type CalendarProps = DayPickerProps

/**
 * react-day-picker v10 — a ground-up rewrite from the v8 API this component
 * used before (upgraded alongside Next.js 15/React 19, since v8 has no React
 * 19 peer support). classNames keys, the Chevron/DayButton components, and
 * fromYear/toYear -> startMonth/endMonth are all new shapes; see
 * date-field.tsx for the caller-side half of that same change.
 */
function Calendar({ className, classNames, showOutsideDays = true, ...props }: CalendarProps) {
  return (
    <DayPicker
      showOutsideDays={showOutsideDays}
      className={cn("p-3", className)}
      classNames={{
        months: "flex flex-col sm:flex-row space-y-4 sm:space-x-4 sm:space-y-0",
        month: "space-y-4",
        month_caption: "flex justify-center pt-1 relative items-center h-7",
        caption_label: "text-sm font-medium",
        nav: "flex items-center justify-between absolute inset-x-1 top-1",
        button_previous: cn(buttonVariants({ variant: "outline" }), "h-7 w-7 bg-transparent p-0 opacity-50 hover:opacity-100"),
        button_next: cn(buttonVariants({ variant: "outline" }), "h-7 w-7 bg-transparent p-0 opacity-50 hover:opacity-100"),
        month_grid: "w-full border-collapse space-y-1",
        weekdays: "flex",
        weekday: "text-muted-foreground rounded-md w-9 font-normal text-[0.8rem]",
        week: "flex w-full mt-1",
        day: "h-9 w-9 text-center text-sm p-0 relative [&:has([aria-selected].range-end)]:rounded-r-md [&:has([aria-selected].outside)]:bg-accent/50 [&:has([aria-selected])]:bg-accent first:[&:has([aria-selected])]:rounded-l-md last:[&:has([aria-selected])]:rounded-r-md focus-within:relative focus-within:z-20",
        range_end: "range-end",
        range_start: "bg-accent rounded-l-md",
        range_middle: "aria-selected:bg-accent aria-selected:text-accent-foreground",
        outside: "outside text-muted-foreground opacity-50 aria-selected:bg-accent/50 aria-selected:text-muted-foreground aria-selected:opacity-30",
        disabled: "text-muted-foreground opacity-50",
        hidden: "invisible",
        dropdowns: "relative inline-flex items-center gap-1",
        months_dropdown: "relative inline-flex items-center",
        years_dropdown: "relative inline-flex items-center",
        dropdown: "absolute inset-0 z-10 w-full cursor-pointer appearance-none opacity-0",
        ...classNames
      }}
      components={{
        DayButton({ day, modifiers, className: dayClassName, ...buttonProps }) {
          return (
            <button
              type="button"
              className={cn(
                buttonVariants({ variant: "ghost" }),
                "h-9 w-9 p-0 font-normal aria-selected:opacity-100",
                dayClassName,
                modifiers.today && "bg-accent text-accent-foreground",
                modifiers.selected &&
                  "bg-primary text-primary-foreground hover:bg-primary hover:text-primary-foreground focus:bg-primary focus:text-primary-foreground",
                modifiers.outside && "text-muted-foreground opacity-50",
                modifiers.disabled && "text-muted-foreground opacity-50"
              )}
              {...buttonProps}
            />
          )
        },
        Chevron({ orientation, className: chevronClassName }) {
          const Icon = orientation === "left" ? ChevronLeft : orientation === "right" ? ChevronRight : orientation === "up" ? ChevronUp : ChevronDown
          return <Icon className={cn("h-4 w-4", chevronClassName)} />
        }
      }}
      {...props}
    />
  )
}
Calendar.displayName = "Calendar"

export { Calendar }
