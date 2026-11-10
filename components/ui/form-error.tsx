import * as React from "react"
import { cn } from "@/lib/utils"

interface FormErrorProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode
}

export function FormError({ children, className, ...props }: FormErrorProps) {
  if (!children) return null

  return (
    <div
      className={cn(
        "flex items-center gap-2 text-sm text-error",
        className
      )}
      role="alert"
      {...props}
    >
      <span className="text-base">⚠</span>
      <span>{children}</span>
    </div>
  )
}
