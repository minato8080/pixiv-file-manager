import { useOutsideClose } from "../hooks/useOutsideClose";

export function SimpleModal({
  isOpen,
  onClose,
  children,
}: {
  isOpen: boolean;
  onClose: () => void;
  children: React.ReactNode;
}) {
  const modalRef = useOutsideClose<HTMLDivElement>({
    onClose,
    enabled: isOpen,
  });

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
      onClick={onClose}
      ref={modalRef}
    >
      <div onClick={(e) => e.stopPropagation()}>{children}</div>
    </div>
  );
}
