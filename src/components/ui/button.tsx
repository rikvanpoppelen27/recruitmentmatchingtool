import { type ButtonHTMLAttributes, forwardRef } from "react";

import { cn } from "../../lib/utils";

export type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";

const VARIANT_CLASSES: Record<ButtonVariant, string> = {
  primary: "bg-neutral-900 text-white hover:bg-neutral-700 disabled:bg-neutral-400",
  secondary: "bg-white text-neutral-900 border border-neutral-300 hover:bg-neutral-50 disabled:text-neutral-400",
  ghost: "bg-transparent text-neutral-700 hover:bg-neutral-100 disabled:text-neutral-400",
  danger: "bg-red-700 text-white hover:bg-red-800 disabled:bg-red-300",
};

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = "primary", type = "button", ...props }, ref) => (
    <button
      ref={ref}
      type={type}
      className={cn(
        "inline-flex items-center justify-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition-colors",
        "disabled:cursor-not-allowed",
        VARIANT_CLASSES[variant],
        className,
      )}
      {...props}
    />
  ),
);
Button.displayName = "Button";
