import clsx from "clsx";

export default function PageShell({ children, className = "", innerClassName = "", fullWidth = false }) {
  return (
    <div className={clsx("page-shell", className)}>
      <div
        className={clsx(
          "page-shell-inner",
          fullWidth && "page-shell-inner--full",
          innerClassName
        )}
      >
        {children}
      </div>
    </div>
  );
}
