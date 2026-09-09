import { createContext, useContext } from 'react';

export const RecipeImportsContext = createContext(null);

export const useRecipeImports = () => useContext(RecipeImportsContext);
