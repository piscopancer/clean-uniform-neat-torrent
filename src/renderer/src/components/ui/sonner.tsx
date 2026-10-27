import { CircleCheckIcon, InfoIcon, OctagonXIcon, TriangleAlertIcon } from "lucide-react"
import { Toaster as Sonner, type ToasterProps } from "sonner"
import { DropSplash } from "@/components/drop-splash"
import { buttonVariants } from "@/components/ui/button"
import { cn } from "@/lib/utils"

/** A toast button takes a row of its own under the icon and text. */
const toastButton = "col-span-full justify-self-end"

/**
 * Sonner's own look is switched off, since its injected styles sit outside the cascade layers and would beat every
 * utility here, its font included. A toast is a key cap like the toolbar keys, with a lip along the bottom that gives
 * it thickness, floating over the window on the shadow of dialogs. Its buttons are the metal ones of the dialogs and
 * sit on a row of their own under the text, at its right end like a dialog footer.
 */
const Toaster = (props: ToasterProps) => (
  <Sonner
    className="toaster group"
    toastOptions={{
      unstyled: true,
      classNames: {
        toast:
          "grid w-(--width) grid-cols-[auto_1fr] items-center gap-x-3 gap-y-3 rounded-xl border bg-surface bg-(image:--key-gradient) p-4 font-sans text-[13px] text-popover-foreground shadow-[var(--key-shadow),var(--float-shadow)]",
        icon: "flex size-4 shrink-0 items-center",
        content: "flex min-w-0 flex-1 flex-col gap-0.5",
        title: "leading-normal font-medium",
        description: "leading-snug text-muted-foreground",
        actionButton: cn(buttonVariants({ size: "sm" }), toastButton),
        cancelButton: cn(buttonVariants({ variant: "outline", size: "sm" }), toastButton),
      },
    }}
    icons={{
      success: <CircleCheckIcon className="size-4" />,
      info: <InfoIcon className="size-4" />,
      warning: <TriangleAlertIcon className="size-4" />,
      error: <OctagonXIcon className="size-4" />,
      loading: <DropSplash />,
    }}
    {...props}
  />
)

export { Toaster }
