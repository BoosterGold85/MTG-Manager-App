import { useEffect, useRef } from "react";
import type { ReactNode } from "react";
import { X } from "lucide-react";
export function Dialog({
  titleId,
  onClose,
  children,
  className = "",
  closeDisabled = false,
}: {
  titleId: string;
  onClose: () => void;
  children: ReactNode;
  className?: string;
  closeDisabled?: boolean;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const dialog = ref.current!;
    const previous = document.activeElement as HTMLElement | null;
    dialog.showModal();
    dialog.querySelector<HTMLButtonElement>(".dialog-close")?.focus();
    return () => {
      dialog.close();
      previous?.focus();
    };
  }, []);
  return (
    <dialog
      ref={ref}
      aria-labelledby={titleId}
      className={`dialog ${className}`}
      onKeyDown={(e) => {
        if (e.key !== "Tab") return;
        const focusable = Array.from(
          e.currentTarget.querySelectorAll<HTMLElement>(
            'button:not(:disabled), input:not(:disabled), select:not(:disabled), a[href], summary, [tabindex="0"]',
          ),
        ).filter(
          (element) => !element.hidden && element.getClientRects().length > 0,
        );
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last?.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first?.focus();
        }
      }}
      onCancel={(e) => {
        e.preventDefault();
        if (!closeDisabled) onClose();
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          const rect = e.currentTarget.getBoundingClientRect();
          if (
            e.clientX < rect.left ||
            e.clientX > rect.right ||
            e.clientY < rect.top ||
            e.clientY > rect.bottom
          )
            if (!closeDisabled) onClose();
        }
      }}
    >
      <button
        className="icon-button dialog-close"
        aria-label="Close dialog"
        onClick={onClose}
        disabled={closeDisabled}
        autoFocus
      >
        <X size={21} />
      </button>
      {children}
    </dialog>
  );
}
