import { useEffect, useRef } from 'react';
/** Trap focus, pause background interactions and restore focus on close. */
export function useDialog(onClose: () => void) {
  const ref = useRef<HTMLElement | null>(null);
  const close = useRef(onClose);
  close.current = onClose;
  useEffect(() => {
    const oldFocus = document.activeElement as HTMLElement | null;
    const overflow = document.body.style.overflow;
    const backgrounds = Array.from(
      document.querySelectorAll<HTMLElement>(
        '.sidebar,.main-shell,.mobile-nav,.console-mobile-nav',
      ),
    );
    const previous = backgrounds.map((el) => el.inert);
    backgrounds.forEach((el) => (el.inert = true));
    document.body.style.overflow = 'hidden';
    const node = ref.current;
    const focusables = () =>
      Array.from(
        node?.querySelectorAll<HTMLElement>(
          'button:not(:disabled),input:not(:disabled),select:not(:disabled),textarea:not(:disabled),a[href],summary,[tabindex="0"]',
        ) || [],
      ).filter((el) => el.getClientRects().length > 0);
    focusables()[0]?.focus();
    const key = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        close.current();
      }
      if (e.key === 'Tab') {
        const items = focusables();
        const first = items[0],
          last = items.at(-1);
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last?.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first?.focus();
        }
      }
    };
    node?.addEventListener('keydown', key);
    return () => {
      node?.removeEventListener('keydown', key);
      document.body.style.overflow = overflow;
      backgrounds.forEach((el, i) => (el.inert = previous[i]));
      oldFocus?.focus();
    };
  }, []);
  return ref;
}
