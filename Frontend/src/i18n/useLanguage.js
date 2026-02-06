import { useContext } from 'react';
import { LanguageContext } from './languageContext';

export function useLanguage() {
  return useContext(LanguageContext);
}
