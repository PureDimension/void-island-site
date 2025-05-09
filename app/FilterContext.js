'use client';

import { createContext, useContext, useState } from 'react';

const FilterContext = createContext();

export function FilterProvider({ children }) {
  const [filterOn, setFilterOn] = useState(false);
  return (
    <FilterContext.Provider value={{ filterOn, setFilterOn }}>
      {children}
    </FilterContext.Provider>
  );
}

export function useFilter() {
  return useContext(FilterContext);
}
