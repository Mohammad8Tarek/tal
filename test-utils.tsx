import React, { ReactElement } from 'react';
// FIX: Import screen, fireEvent, and waitFor to explicitly re-export them.
import { render, RenderOptions, screen, fireEvent, waitFor } from '@testing-library/react';
import { AuthProvider } from './hooks/useAuth';
import { LanguageProvider } from './context/LanguageContext';
import { ToastProvider } from './context/ToastContext';
import { HashRouter } from 'react-router-dom';

const AllTheProviders: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  return (
    <HashRouter>
      <AuthProvider>
        <LanguageProvider>
          <ToastProvider>{children}</ToastProvider>
        </LanguageProvider>
      </AuthProvider>
    </HashRouter>
  );
};

const customRender = (
  ui: ReactElement,
  options?: Omit<RenderOptions, 'wrapper'>
) => render(ui, { wrapper: AllTheProviders, ...options });

// FIX: Remove star export and explicitly export common utilities along with the custom render.
// This is more robust against toolchain issues with `export *`.
export { customRender as render, screen, fireEvent, waitFor };
