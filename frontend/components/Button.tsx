import { cn } from "@/lib/utils";

type Variant = "primary" | "secondary" | "ghost" | "danger" | "success";
type Size = "sm" | "md" | "lg";

const VARIANTS: Record<Variant, string> = {
  primary:
    "bg-brand-600 text-white hover:bg-brand-700 active:bg-brand-800 shadow-sm",
  secondary:
    "bg-white text-slate-700 border border-slate-300 hover:bg-slate-50 active:bg-slate-100",
  ghost: "bg-transparent text-slate-600 hover:bg-slate-100",
  danger: "bg-red-600 text-white hover:bg-red-700 active:bg-red-800 shadow-sm",
  success:
    "bg-emerald-600 text-white hover:bg-emerald-700 active:bg-emerald-800 shadow-sm",
};

const SIZES: Record<Size, string> = {
  sm: "h-9 px-3 text-sm",
  md: "h-11 px-5 text-sm",
  lg: "h-12 px-6 text-base",
};

/** <Link> 等にボタン見た目を付けるためのクラス生成関数。 */
export function buttonVariants(variant: Variant = "primary", size: Size = "md"): string {
  return cn(
    "inline-flex items-center justify-center gap-2 rounded-lg font-medium transition-colors",
    "focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-400 focus-visible:ring-offset-2",
    "disabled:opacity-50 disabled:pointer-events-none whitespace-nowrap",
    VARIANTS[variant],
    SIZES[size],
  );
}

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
}

export function Button({
  variant = "primary",
  size = "md",
  className,
  ...props
}: ButtonProps) {
  return <button className={cn(buttonVariants(variant, size), className)} {...props} />;
}
