import * as React from "react"
import { cn } from "@/lib/utils"
import { XIcon } from "lucide-react"
import { Dialog as DialogPrimitive } from "radix-ui"

import { Button } from "@/components/ui/button"

function Dialog({
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Root>) {
  return <DialogPrimitive.Root data-slot="dialog" {...props} />
}

function DialogTrigger({
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Trigger>) {
  return <DialogPrimitive.Trigger data-slot="dialog-trigger" {...props} />
}

function DialogPortal({
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Portal>) {
  return <DialogPrimitive.Portal data-slot="dialog-portal" {...props} />
}

function DialogClose({
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Close>) {
  return <DialogPrimitive.Close data-slot="dialog-close" {...props} />
}

function DialogOverlay({
  className,
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Overlay>) {
  return (
    <DialogPrimitive.Overlay
      data-slot="dialog-overlay"
      className={cn(
        "fixed inset-0 z-50 modal-backdrop data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:animate-in data-[state=open]:fade-in-0",
        className
      )}
      {...props}
    />
  )
}

/**
 * Centered card that never outgrows the viewport: it is a column of header, body and footer, and only `DialogBody`
 * scrolls when the content is taller than the window minus a margin above and below.
 */
function DialogContent({
  className,
  children,
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Content>) {
  return (
    <DialogPortal data-slot="dialog-portal">
      <DialogOverlay />
      <DialogPrimitive.Content
        data-slot="dialog-content"
        className={cn(
          "fixed top-[50%] left-[50%] z-50 flex max-h-[calc(100dvh-4rem)] w-full max-w-[calc(100%-2rem)] translate-x-[-50%] translate-y-[-50%] flex-col overflow-hidden rounded-xl border bg-card shadow-float duration-200 outline-none data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95 data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95 sm:max-w-lg",
          className
        )}
        {...props}
      >
        {children}
      </DialogPrimitive.Content>
    </DialogPortal>
  )
}

/** Title and description with the close button beside them, centred on the first line of the title. */
function DialogHeader({
  className,
  children,
  showCloseButton = true,
  ...props
}: React.ComponentProps<"div"> & {
  showCloseButton?: boolean
}) {
  return (
    <div
      data-slot="dialog-header"
      className={cn("flex shrink-0 items-start gap-4 px-6 pt-6 pb-4", className)}
      {...props}
    >
      <div className="flex min-w-0 flex-1 flex-col gap-2 text-center sm:text-left">
        {children}
      </div>
      {showCloseButton && (
        // as tall as one line of the title, so the cross sits level with it whatever the title's size
        <div className="flex h-[1lh] items-center text-3xl leading-tight">
          <DialogPrimitive.Close
            data-slot="dialog-close"
            className="rounded-xs opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:ring-2 focus:ring-ring focus:ring-offset-2 focus:outline-hidden disabled:pointer-events-none [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4"
          >
            <XIcon />
            <span className="sr-only">Close</span>
          </DialogPrimitive.Close>
        </div>
      )}
    </div>
  )
}

/** The part between header and footer, scrolling on its own when the dialog reaches the viewport's height. */
function DialogBody({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="dialog-body"
      className={cn("flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-6 pb-6", className)}
      {...props}
    />
  )
}

/**
 * Muted band along the dialog's bottom edge, lying a step below the white body: the body casts a soft shadow down onto
 * its top edge.
 */
const footerBand =
  "shrink-0 rounded-b-xl border-t bg-background/60 px-6 py-4 shadow-[inset_0_8px_10px_-8px_oklch(0_0_0/14%)] dark:shadow-[inset_0_8px_10px_-8px_oklch(0_0_0/45%)]"

/** The same band for the alert dialog footer, offsetting that dialog's p-6. */
const dialogFooterBand = cn("-mx-6 -mb-6", footerBand)

function DialogFooter({
  className,
  showCloseButton = false,
  children,
  ...props
}: React.ComponentProps<"div"> & {
  showCloseButton?: boolean
}) {
  return (
    <div
      data-slot="dialog-footer"
      className={cn(
        footerBand,
        "flex flex-col-reverse gap-2 sm:flex-row sm:justify-end",
        className
      )}
      {...props}
    >
      {children}
      {showCloseButton && (
        <DialogPrimitive.Close asChild>
          <Button variant="outline">Close</Button>
        </DialogPrimitive.Close>
      )}
    </div>
  )
}

function DialogTitle({
  className,
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Title>) {
  return (
    <DialogPrimitive.Title
      data-slot="dialog-title"
      className={cn("serif-title text-3xl leading-tight", className)}
      {...props}
    />
  )
}

function DialogDescription({
  className,
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Description>) {
  return (
    <DialogPrimitive.Description
      data-slot="dialog-description"
      className={cn("text-sm text-muted-foreground", className)}
      {...props}
    />
  )
}

export {
  Dialog,
  DialogBody,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogOverlay,
  DialogPortal,
  DialogTitle,
  DialogTrigger,
  dialogFooterBand,
}
