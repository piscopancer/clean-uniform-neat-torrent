import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "@/lib/utils"
import { Slot } from "radix-ui"

const buttonVariants = cva(
  "inline-flex shrink-0 items-center justify-center gap-2 rounded-md text-sm font-medium whitespace-nowrap transition-all outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:pointer-events-none disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  {
    variants: {
      variant: {
        default: "metal-fill-primary text-primary-foreground hover:brightness-110 dark:[--metal-brush:oklch(0_0_0/12%)] dark:[--metal-glint:linear-gradient(110deg,transparent_22%,oklch(1_0_0/50%)_46%,transparent_70%)]",
        highlight: "glass-fill-highlight text-highlight-foreground hover:brightness-105",
        destructive:
          "metal-fill-destructive text-white hover:brightness-110 focus-visible:ring-destructive/20 dark:[--fill:color-mix(in_oklch,var(--color-destructive)_75%,black)] dark:focus-visible:ring-destructive/40",
        outline:
          "metal-fill-surface hover:brightness-103 [--metal-depth:1px] dark:[--fill:color-mix(in_oklch,var(--color-surface)_55%,black)] dark:[--metal-edge:oklch(1_0_0/12%)] dark:[--metal-rim:oklch(1_0_0/14%)] dark:[--metal-rim-bottom:oklch(1_0_0/6%)] dark:[--metal-outline:oklch(1_0_0/18%)] dark:[--metal-brush:transparent] dark:[--metal-glint:none] aria-pressed:border-highlight/40 aria-pressed:bg-highlight/15 aria-pressed:text-highlight aria-pressed:hover:bg-highlight/20",
        glass:
          "glass-toggle hover:brightness-105 data-[state=checked]:text-highlight-foreground",
        secondary:
          "raised text-secondary-foreground hover:bg-accent",
        ghost:
          "hover:bg-accent hover:text-accent-foreground dark:hover:bg-accent/50",
        link: "text-primary underline-offset-4 hover:underline",
      },
      size: {
        default: "h-9 px-4 py-2 has-[>svg]:px-3",
        xs: "h-6 gap-1 rounded-md px-2 text-xs has-[>svg]:px-1.5 [&_svg:not([class*='size-'])]:size-3",
        sm: "h-8 gap-1.5 rounded-md px-3 has-[>svg]:px-2.5",
        lg: "h-10 rounded-md px-6 has-[>svg]:px-4",
        icon: "size-9",
        "icon-xs": "size-6 rounded-md [&_svg:not([class*='size-'])]:size-3",
        "icon-sm": "size-8",
        "icon-lg": "size-10",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

function Button({
  className,
  variant = "default",
  size = "default",
  asChild = false,
  ...props
}: React.ComponentProps<"button"> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean
  }) {
  const Comp = asChild ? Slot.Root : "button"

  return (
    <Comp
      data-slot="button"
      data-variant={variant}
      data-size={size}
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  )
}

export { Button, buttonVariants }
