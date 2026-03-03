import * as React from "react";

interface SelectProps {
  value: string;
  onValueChange: (value: string) => void;
  children: React.ReactNode;
  className?: string;
}

interface SelectItemProps {
  value: string;
  children: React.ReactNode;
}

export function Select({ value, onValueChange, children, className }: SelectProps) {
  return (
    <select
      value={value}
      onChange={(e) => onValueChange(e.target.value)}
      className={`border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 ${className || ""}`}
    >
      {children}
    </select>
  );
}

export function SelectItem({ value, children }: SelectItemProps) {
  return <option value={value}>{children}</option>;
}

// Optional wrapper if you want "SelectTrigger" and "SelectValue" aliases
export const SelectTrigger = Select;
export const SelectValue = () => null; // Placeholder, handled by HTML select
export const SelectContent = ({ children }: { children: React.ReactNode }) => <>{children}</>;
