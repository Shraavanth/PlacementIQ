import { useEffect, useRef, useCallback } from 'react';
import { useLocation } from 'react-router-dom';

/**
 * Custom hook to apply a temporary deep-green/emerald glow highlight
 * to a target element for approximately 1.5 seconds.
 * 
 * Features:
 * - Automatically triggers on hash changes or cross-route navigation
 * - Smooth scroll into view
 * - Handles rapid consecutive clicks (cancels prior timer)
 * - Removes glow automatically after 1500ms
 * - Cleans up timers and classes on unmount
 * - Accessible and non-blocking
 */
export function useGlowHighlight() {
  const location = useLocation();
  const timerRef = useRef(null);

  const triggerGlow = useCallback((targetId) => {
    if (!targetId) return;
    const cleanId = targetId.replace(/^#/, '');
    const element = document.getElementById(cleanId);
    if (!element) return;

    // Smoothly bring destination into view
    element.scrollIntoView({ behavior: 'smooth', block: 'start' });

    // Cancel any running timer from previous rapid clicks
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }

    // Remove glow class from any currently highlighted element
    document.querySelectorAll('.glow-highlight').forEach((el) => {
      el.classList.remove('glow-highlight');
    });

    // Apply deep green glow effect
    element.classList.add('glow-highlight');

    // Automatically remove after approximately 1.5 seconds
    timerRef.current = setTimeout(() => {
      element.classList.remove('glow-highlight');
      timerRef.current = null;
    }, 1500);
  }, []);

  useEffect(() => {
    if (location.hash) {
      // Allow slight delay for component mounting/rendering
      const frameId = setTimeout(() => {
        triggerGlow(location.hash);
      }, 120);
      return () => clearTimeout(frameId);
    }
  }, [location.hash, location.pathname, triggerGlow]);

  useEffect(() => {
    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
      document.querySelectorAll('.glow-highlight').forEach((el) => {
        el.classList.remove('glow-highlight');
      });
    };
  }, []);

  return { triggerGlow };
}
