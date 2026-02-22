"use client"

import { useEffect, useRef } from "react";

/**
 * Focus trap hook for modals and dropdowns
 * Keeps keyboard focus within a container element
 *
 * @param ref - Reference to the container element
 * @param isActive - Whether the focus trap should be active
 */
export function useFocusTrap(
  ref: React.RefObject<HTMLElement>,
  isActive: boolean = true
) {
  const firstFocusableRef = useRef<HTMLElement | null>(null);
  const lastFocusableRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!isActive || !ref.current) return;

    // Find all focusable elements within the container
    const focusableElements = ref.current.querySelectorAll(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    );

    if (focusableElements.length === 0) return;

    const firstFocusable = focusableElements[0] as HTMLElement;
    const lastFocusable = focusableElements[focusableElements.length - 1] as HTMLElement;

    firstFocusableRef.current = firstFocusable;
    lastFocusableRef.current = lastFocusable;

    // Focus the first element when trap activates
    firstFocusable.focus();

    const handleTab = (e: KeyboardEvent) => {
      if (e.key !== "Tab") return;

      // Check if focus is leaving the container
      if (e.shiftKey) {
        // Shift + Tab
        if (document.activeElement === firstFocusable) {
          e.preventDefault();
          lastFocusable.focus();
        }
      } else {
        // Tab
        if (document.activeElement === lastFocusable) {
          e.preventDefault();
          firstFocusable.focus();
        }
      }
    };

    // Add event listener
    document.addEventListener("keydown", handleTab);

    // Return focus to the element that had focus before trap activation
    const previousActiveElement = document.activeElement as HTMLElement;

    return () => {
      document.removeEventListener("keydown", handleTab);
      // Restore focus when trap is deactivated
      if (previousActiveElement && typeof previousActiveElement.focus === "function") {
        previousActiveElement.focus();
      }
    };
  }, [ref, isActive]);
}

/**
 * Focus management hook for modals/dropdowns with Escape key support
 *
 * @param ref - Reference to the container element
 * @param isOpen - Whether the modal/dropdown is open
 * @param onClose - Callback when Escape key is pressed
 */
export function useFocusManager(
  ref: React.RefObject<HTMLElement>,
  isOpen: boolean,
  onClose?: () => void
) {
  const wasOpen = useRef(false);

  useEffect(() => {
    // Focus trap when opening
    if (isOpen && !wasOpen.current && ref.current) {
      wasOpen.current = true;

      // Find and focus first focusable element
      const focusableElements = ref.current.querySelectorAll(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
      );

      if (focusableElements.length > 0) {
        (focusableElements[0] as HTMLElement).focus();
      }
    }

    // Reset when closing
    if (!isOpen && wasOpen.current) {
      wasOpen.current = false;
    }
  }, [isOpen, ref]);

  useEffect(() => {
    if (!isOpen || !onClose) return;

    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      }
    };

    document.addEventListener("keydown", handleEscape);
    return () => document.removeEventListener("keydown", handleEscape);
  }, [isOpen, onClose]);
}
