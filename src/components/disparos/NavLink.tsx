import { Link } from "@tanstack/react-router";
import { forwardRef, type ReactNode } from "react";

interface NavLinkCompatProps {
  to: string;
  end?: boolean;
  className?: string;
  activeClassName?: string;
  children?: ReactNode;
}

// Compat wrapper que reproduz a API do NavLink do react-router (className + activeClassName)
// usando o Link do TanStack Router (activeProps + activeOptions).
const NavLink = forwardRef<HTMLAnchorElement, NavLinkCompatProps>(
  ({ className, activeClassName, to, end, children, ...props }, ref) => {
    return (
      <Link
        ref={ref as never}
        to={to as never}
        activeOptions={{ exact: !!end }}
        className={className}
        activeProps={activeClassName ? { className: activeClassName } : undefined}
        {...props}
      >
        {children}
      </Link>
    );
  },
);

NavLink.displayName = "NavLink";

export { NavLink };
