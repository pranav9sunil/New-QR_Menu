import * as React from "react"
import { Check } from "lucide-react"
import { cn } from "@/lib/utils"

const Checkbox = React.forwardRef<
    HTMLButtonElement,
    Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, 'onChange'> & {
        onCheckedChange?: (checked: boolean) => void
        checked?: boolean
    }
>(({ className, checked, onCheckedChange, ...props }, ref) => {
    return (
        <button
            type="button"
            role="checkbox"
            aria-checked={checked}
            data-state={checked ? "checked" : "unchecked"}
            onClick={() => onCheckedChange?.(!checked)}
            className={cn(
                "peer h-4 w-4 shrink-0 rounded-sm border border-primary ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 data-[state=checked]:bg-primary data-[state=checked]:text-primary-foreground bg-white flex items-center justify-center",
                className
            )}
            ref={ref}
            {...props}
        >
            <Check className={cn("h-3 w-3 text-white pointer-events-none", checked ? "opacity-100" : "opacity-0")} />
        </button>
    )
})
Checkbox.displayName = "Checkbox"

export { Checkbox }
