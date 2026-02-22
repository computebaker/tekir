"use client"

import { Toaster as Sonner } from "sonner"
import { useTheme } from "next-themes"

function Toaster() {
  const { theme = "system" } = useTheme()

  return (
    <Sonner
      theme={theme as "light" | "dark" | "system"}
      position="bottom-right"
      expand={false}
      richColors
      closeButton
      toastOptions={{
        classNames: {
          toast: "toast toast-styled",
          description: "toast-description",
          actionButton: "toast-action-button",
          cancelButton: "toast-cancel-button",
          closeButton: "toast-close-button",
        },
      }}
    />
  )
}

export { Toaster }
