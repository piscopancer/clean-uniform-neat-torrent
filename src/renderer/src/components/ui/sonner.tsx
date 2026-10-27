import { CircleCheckIcon, InfoIcon, OctagonXIcon, TriangleAlertIcon } from "lucide-react"
import type * as React from "react"
import { Toaster as Sonner, type ToasterProps } from "sonner"
import { DropSplash } from "@/components/drop-splash"

const toasterStyle = {
  "--normal-bg": "var(--popover)",
  "--normal-text": "var(--popover-foreground)",
  "--normal-border": "var(--border)",
  "--border-radius": "var(--radius)",
} satisfies Record<`--${string}`, string>

const Toaster = (props: ToasterProps) => (
  <Sonner
    className="toaster group"
    toastOptions={{ classNames: { toast: "shadow-float!" } }}
    icons={{
      success: <CircleCheckIcon className="size-4" />,
      info: <InfoIcon className="size-4" />,
      warning: <TriangleAlertIcon className="size-4" />,
      error: <OctagonXIcon className="size-4" />,
      loading: <DropSplash />,
    }}
    // CSS custom properties are not part of React.CSSProperties
    style={toasterStyle as React.CSSProperties}
    {...props}
  />
)

export { Toaster }
