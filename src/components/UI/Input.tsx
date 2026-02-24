import React from "react";
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, label, error, ...props }, ref) => {
    return (
      <div className="w-full space-y-1.5">
        {label && (
          <label className="text-sm font-bold text-muted uppercase tracking-wider">
            {label}
          </label>
        )}
        <input
          className={cn(
            "w-full bg-white/80 border border-gray-200 rounded-xl px-4 py-3 outline-none transition-all duration-200 focus:ring-2 focus:ring-primary/20 focus:border-primary placeholder:text-gray-400 shadow-sm",
            error && "border-danger focus:ring-danger/20 focus:border-danger",
            className,
          )}
          ref={ref}
          {...props}
        />
        {error && (
          <p className="text-sm font-bold text-danger animate-in fade-in slide-in-from-top-1">
            {error}
          </p>
        )}
      </div>
    );
  },
);

Input.displayName = "Input";
