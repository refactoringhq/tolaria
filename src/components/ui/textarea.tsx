import * as React from "react"

import { nativeTextAssistanceDisabledProps } from "@/lib/nativeTextAssistance"
import { cn } from "@/lib/utils"

const Textarea = React.forwardRef<HTMLTextAreaElement, React.ComponentProps<"textarea">>(
  ({ className, ...props }, ref) => (
    <textarea
      ref={ref}
      data-slot="textarea"
      {...nativeTextAssistanceDisabledProps}
      className={cn(
        "border-input placeholder:text-muted-foreground selection:bg-primary selection:text-primary-foreground flex min-h-20 w-full rounded-md border bg-transparent px-3 py-2 text-base shadow-xs transition-[color,box-shadow] outline-none disabled:cursor-not-allowed disabled:opacity-50 md:text-sm",
        "focus-visible:border-ring focus-visible:ring-focus-halo focus-visible:ring-[3px]",
        "aria-invalid:ring-destructive-halo aria-invalid:border-destructive",
        className
      )}
      {...props}
    />
  ),
)
Textarea.displayName = "Textarea"

export { Textarea }
