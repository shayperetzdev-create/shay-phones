import * as React from "react"
import { Label } from "./label"
import { Input } from "./input"

interface FormFieldProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label: string
  error?: string
  success?: boolean
  required?: boolean
  helperText?: string
}

export const FormField = React.forwardRef<HTMLInputElement, FormFieldProps>(
  ({ label, error, success, required, helperText, className, ...props }, ref) => {
    return (
      <div className="space-y-2">
        <Label htmlFor={props.id} required={required}>
          {label}
        </Label>
        <Input
          ref={ref}
          error={!!error}
          success={success}
          className={className}
          {...props}
        />
        {error && (
          <p className="text-sm text-error flex items-center gap-1 text-right">
            <span>⚠️</span>
            <span>{error}</span>
          </p>
        )}
        {!error && helperText && (
          <p className="text-sm text-muted-foreground">{helperText}</p>
        )}
      </div>
    )
  }
)

FormField.displayName = "FormField"
