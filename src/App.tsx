import { useEffect } from 'react';
import { BrowserRouter } from 'react-router-dom';
import { AuthProvider } from './app/providers/AuthProvider';
import { AppRouter } from './app/router/AppRouter';
import { PWAStatusControls } from './components/pwa/PWAStatusControls';
import { ToastProvider } from './components/ui/Toast';
import { initFirebaseAnalytics } from './lib/firebase';

export default function App() {
  useEffect(() => {
    void initFirebaseAnalytics();
  }, []);

  return (
    <BrowserRouter>
      <ToastProvider>
        <AuthProvider>
          <AppRouter />
          <PWAStatusControls />
        </AuthProvider>
      </ToastProvider>
    </BrowserRouter>
  );
}
