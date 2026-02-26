"use client"

import * as React from "react"
import { CalendarIcon } from "lucide-react"
import { format } from "date-fns"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Calendar } from "@/components/ui/calendar"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"

interface DateTimePickerProps {
  date: Date | undefined
  setDate: (date: Date | undefined) => void
  granularity?: "day" | "minute"
}

export function DateTimePicker({ date, setDate, granularity = "minute" }: DateTimePickerProps) {
  const [selectedDateTime, setSelectedDateTime] = React.useState<Date | undefined>(date)

  // Update the parent's state when our state changes
  React.useEffect(() => {
    setDate(selectedDateTime)
  }, [selectedDateTime, setDate])

  // Update our state when the parent's state changes
  React.useEffect(() => {
    setSelectedDateTime(date)
  }, [date])

  const handleSelect = (date: Date | undefined) => {
    if (!date) {
      setSelectedDateTime(undefined)
      return
    }

    // If we already have a date, preserve the time
    if (selectedDateTime) {
      const newDate = new Date(date)
      newDate.setHours(selectedDateTime.getHours())
      newDate.setMinutes(selectedDateTime.getMinutes())
      setSelectedDateTime(newDate)
    } else {
      setSelectedDateTime(date)
    }
  }

  const handleTimeChange = (time: string) => {
    if (!selectedDateTime) return

    const [hours, minutes] = time.split(":").map(Number)
    const newDate = new Date(selectedDateTime)
    newDate.setHours(hours)
    newDate.setMinutes(minutes)
    setSelectedDateTime(newDate)
  }

  // Generate time options in 15-minute intervals
  const timeOptions = React.useMemo(() => {
    const options = []
    for (let hour = 0; hour < 24; hour++) {
      for (let minute = 0; minute < 60; minute += 15) {
        const formattedHour = hour.toString().padStart(2, "0")
        const formattedMinute = minute.toString().padStart(2, "0")
        options.push(`${formattedHour}:${formattedMinute}`)
      }
    }
    return options
  }, [])

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant={"outline"}
          className={cn("w-full justify-start text-left font-normal", !date && "text-muted-foreground")}
        >
          <CalendarIcon className="mr-2 h-4 w-4" />
          {date ? granularity === "minute" ? format(date, "PPP p") : format(date, "PPP") : <span>Pick a date</span>}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <Calendar mode="single" selected={selectedDateTime} onSelect={handleSelect} initialFocus />
        {granularity === "minute" && (
          <div className="p-3 border-t border-border">
            <Select
              value={selectedDateTime ? format(selectedDateTime, "HH:mm") : undefined}
              onValueChange={handleTimeChange}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select time" />
              </SelectTrigger>
              <SelectContent className="max-h-[300px]">
                {timeOptions.map((time) => (
                  <SelectItem key={time} value={time}>
                    {format(
                      new Date().setHours(Number.parseInt(time.split(":")[0]), Number.parseInt(time.split(":")[1])),
                      "p",
                    )}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}
      </PopoverContent>
    </Popover>
  )
}
