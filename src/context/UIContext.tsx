import React, { createContext, useContext, useState, useEffect } from 'react';

interface UIContextType {
  isFabHidden: boolean;
  setIsFabHidden: (hidden: boolean) => void;
}

const UIContext = createContext<UIContextType | undefined>(undefined);

export function UIProvider({ children }: { children: React.ReactNode }) {
  const [isFabHidden, setIsFabHidden] = useState(false);

  return (
    <UIContext.Provider value={{ isFabHidden, setIsFabHidden }}>
      {children}
    </UIContext.Provider>
  );
}

export function useUI() {
  const context = useContext(UIContext);
  if (context === undefined) {
    throw new Error('useUI must be used within a UIProvider');
  }
  return context;
}
