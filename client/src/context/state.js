import { createContext, useContext } from 'react';
export const AppContext = createContext(null);
export const useApp = () => useContext(AppContext);
