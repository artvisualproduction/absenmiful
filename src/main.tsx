import { createRoot } from 'react-dom/client';
import App from './App';
import './index.css';

if (typeof document !== 'undefined') {
  const preventEvent = (event: Event) => {
    event.preventDefault();
  };

  document.addEventListener('gesturestart', preventEvent, { passive: false });
  document.addEventListener('gesturechange', preventEvent, { passive: false });
  document.addEventListener('gestureend', preventEvent, { passive: false });

  document.addEventListener(
    'touchstart',
    (event) => {
      if (event.touches.length > 1) {
        event.preventDefault();
      }
    },
    { passive: false },
  );

  let lastTouchEnd = 0;
  document.addEventListener(
    'touchend',
    (event) => {
      const now = Date.now();
      if (now - lastTouchEnd <= 300) {
        const target = event.target as HTMLElement | null;
        if (target && !['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName)) {
          event.preventDefault();
        }
      }
      lastTouchEnd = now;
    },
    { passive: false },
  );

  window.addEventListener(
    'wheel',
    (event) => {
      if (event.ctrlKey) {
        event.preventDefault();
      }
    },
    { passive: false },
  );
}

createRoot(document.getElementById('root')!).render(<App />);
