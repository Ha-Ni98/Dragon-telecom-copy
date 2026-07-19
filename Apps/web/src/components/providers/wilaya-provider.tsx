import React, { createContext, useContext, useMemo, ReactNode } from 'react';
import { Wilaya, Commune, WilayaContextValue } from '@/types/draft-types/wilaya.types';
import wilayasData from '@/config/algeria-wilayas.json';
import communesData from '@/config/algeria-commun.json';

const WilayaContext = createContext<WilayaContextValue | undefined>(undefined);

interface WilayaProviderProps {
  children: ReactNode;
}

export function WilayaProvider({ children }: WilayaProviderProps) {
  const value = useMemo<WilayaContextValue>(() => {
    const wilayas = wilayasData as Wilaya[];
    const communes = communesData as Commune[];

    const getWilayaByCode = (code: string): Wilaya | undefined => {
      return wilayas.find(wilaya => wilaya.code === code);
    };

    const getCommunesByWilayaCode = (wilayaCode: string): Commune[] => {
      const formattedCode = wilayaCode.padStart(2, '0');
      return communes.filter(commune => commune.wilaya_code === formattedCode);
    };

    const getWilayaNameByCode = (code: string): string => {
      const wilaya = getWilayaByCode(code);
      return wilaya?.name || '';
    };

    const getCommuneNameById = (id: number): string => {
      const commune = communes.find(c => c.id === id);
      return commune?.commune_name_ascii || '';
    };

    const getCommunesByWilayaName = (wilayaName: string): Commune[] => {
      const formattedName = wilayaName.padStart(2, '0');
      return communes.filter(commune => commune.wilaya_name_ascii === formattedName);
    };

    return {
      wilayas,
      communes,
      getWilayaByCode,
      getCommunesByWilayaCode,
      getWilayaNameByCode,
      getCommuneNameById,
      getCommunesByWilayaName,
    };
  }, []);

  return <WilayaContext.Provider value={value}>{children}</WilayaContext.Provider>;
}

export function useWilayaContext(): WilayaContextValue {
  const context = useContext(WilayaContext);
  if (!context) {
    throw new Error('useWilayaContext must be used within a WilayaProvider');
  }
  return context;
}
