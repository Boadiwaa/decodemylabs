import React, { createContext, useContext, useState, useCallback } from 'react';

const AppContext = createContext();

export function AppProvider({ children }) {
  const [toastMessage, setToastMessage] = useState(null);

  // App is patient-only — no clinician mode
  const mode = 'patient';

  const showToast = useCallback((message) => {
    setToastMessage(message);
    setTimeout(() => setToastMessage(null), 2500);
  }, []);

  return (
    <AppContext.Provider value={{ mode, toastMessage, showToast }}>
      {children}
    </AppContext.Provider>
  );
}

export function useAppContext() {
  return useContext(AppContext);
}