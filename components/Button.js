import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";

const base =
  "inline-flex items-center gap-2 font-bold rounded-full transition duration-150 ease-out active:scale-[0.97] focus-visible:outline-none focus-visible:ring-2";

const variants = {
  // white fill / navy text — for use on dark or photo backgrounds
  light:
    "bg-white text-brand-navy hover:bg-brand-sky focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-brand-deep",
  // navy fill / white text — for use on light backgrounds
  dark:
    "bg-brand-navy text-white shadow-lg shadow-brand-navy/20 hover:bg-brand-deep focus-visible:ring-brand-navy focus-visible:ring-offset-2 focus-visible:ring-offset-white",
  // translucent border / white text — secondary action on dark or photo backgrounds
  outline:
    "border border-white/40 text-white hover:bg-white/10 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-brand-deep",
  // navy border / navy text — secondary action on light backgrounds
  quiet:
    "border border-brand-navy/20 bg-white text-brand-navy hover:bg-brand-sky focus-visible:ring-brand-navy focus-visible:ring-offset-2 focus-visible:ring-offset-white",
};

const sizes = {
  lg: "text-sm sm:text-base px-6 sm:px-7 py-3.5",
  sm: "text-sm px-5 py-1.5",
};

/** A pill link — or, with no `href`, a pill <button> in the same styles. */
export default function Button({
  href,
  variant = "light",
  size = "lg",
  icon = true,
  className,
  children,
  type = "button",
  ...rest
}) {
  const classes = cn(base, variants[variant], sizes[size], className);
  const content = (
    <>
      {children}
      {icon && <ArrowRight className="w-4 h-4" aria-hidden="true" />}
    </>
  );

  if (!href) {
    return (
      <button type={type} className={classes} {...rest}>
        {content}
      </button>
    );
  }

  return (
    <Link href={href} className={classes} {...rest}>
      {content}
    </Link>
  );
}
