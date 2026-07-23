import { forwardRef, type InputHTMLAttributes, type SelectHTMLAttributes, type TextareaHTMLAttributes } from "react";

import { cn } from "../../lib/utils";

const FIELD_CLASSES =
  "w-full rounded-md border border-neutral-300 bg-surface px-3 py-2 text-sm text-ink " +
  "placeholder:text-neutral-400 focus:outline-none focus:ring-2 focus:ring-accent disabled:bg-neutral-100";

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(
  ({ className, ...props }, ref) => <input ref={ref} className={cn(FIELD_CLASSES, className)} {...props} />,
);
Input.displayName = "Input";

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement>>(
  ({ className, ...props }, ref) => <textarea ref={ref} className={cn(FIELD_CLASSES, className)} {...props} />,
);
Textarea.displayName = "Textarea";

export const Select = forwardRef<HTMLSelectElement, SelectHTMLAttributes<HTMLSelectElement>>(
  ({ className, ...props }, ref) => <select ref={ref} className={cn(FIELD_CLASSES, className)} {...props} />,
);
Select.displayName = "Select";
