"use client"

import * as React from "react"
import { useState, useEffect } from "react"
import * as ProgressPrimitive from "@radix-ui/react-progress"

import { cn } from "@/lib/utils"

interface ProgressProps extends React.ComponentPropsWithoutRef<typeof ProgressPrimitive.Root> {
  value?: number | null;
  max?: number;
}

const Progress = React.forwardRef<
  React.ElementRef<typeof ProgressPrimitive.Root>,
  ProgressProps
>(({ className, value, max = 100, ...props }, ref) => {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const validValue = value ?? 0;
  const percentage = Math.min(100, Math.max(0, (validValue / max) * 100));

  return (
    <ProgressPrimitive.Root
      ref={ref}
      className={cn(
        "relative h-4 w-full overflow-hidden rounded-full bg-secondary",
        className
      )}
      {...props}
      value={percentage}
    >
      <ProgressPrimitive.Indicator
        className="h-full w-full flex-1 bg-primary transition-all"
        style={{ transform: `translateX(-${100 - (mounted ? percentage : 0)}%)` }}
      />
    </ProgressPrimitive.Root>
  )
})
Progress.displayName = ProgressPrimitive.Root.displayName

export { Progress }
