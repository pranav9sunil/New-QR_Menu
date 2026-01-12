import * as React from "react"
import * as SwitchPrimitives from "@radix-ui/react-switch"
import { Check, X } from "lucide-react"

import { cn } from "@/lib/utils"

const Switch = React.forwardRef<
    React.ElementRef<typeof SwitchPrimitives.Root>,
    React.ComponentPropsWithoutRef<typeof SwitchPrimitives.Root>
>(({ className, ...props }, ref) => (
    <SwitchPrimitives.Root
        className={cn(
            "peer inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full border-transparent transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:cursor-not-allowed disabled:opacity-50 data-[state=checked]:bg-green-600 data-[state=unchecked]:bg-red-500 relative",
            className
        )}
        {...props}
        ref={ref}
    >
        <SwitchPrimitives.Thumb
            className={cn(
                "pointer-events-none block h-5 w-5 rounded-full bg-white shadow-lg ring-0 transition-transform data-[state=checked]:translate-x-5 data-[state=unchecked]:translate-x-0.5 z-10"
            )}
        />
        <div className="absolute inset-0 flex items-center justify-between px-1.5 pointer-events-none">
            <Check className="h-3 w-3 text-white opacity-0 transition-opacity duration-200 data-[state=checked]:opacity-100" data-state={props.checked ? 'checked' : 'unchecked'} />
            <X className="h-3 w-3 text-white opacity-0 transition-opacity duration-200 data-[state=unchecked]:opacity-100" data-state={props.checked ? 'checked' : 'unchecked'} />
        </div>
    </SwitchPrimitives.Root>
))
Switch.displayName = SwitchPrimitives.Root.displayName

export { Switch }
