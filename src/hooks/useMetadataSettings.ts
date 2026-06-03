import { useCallback } from 'react';

export const useMetadataSettings = () => {
  const isVisible = useCallback((_field: string) => true, []);
  
  return {
    isVisible,
  };
};
