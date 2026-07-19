import { useMemo } from 'react';
import { useWilayaContext } from '@/components/providers/wilaya-provider';
import { Wilaya, Commune } from '@/types/draft-types/wilaya.types';

export function useWilaya() {
  const context = useWilayaContext();

  const wilayaOptions = useMemo(() => {
    return context.wilayas.map(wilaya => ({
      value: wilaya.code,
      label: wilaya.name,
      arLabel: wilaya.ar_name,
    }));
  }, [context.wilayas]);

  const getCommuneOptions = (wilayaCode: string) => {
    const communes = context.getCommunesByWilayaCode(wilayaCode);
    return communes.map(commune => ({
      value: commune.commune_name_ascii,
      label: commune.commune_name_ascii,
      arLabel: commune.commune_name,
    }));
  };

  const getCommuneOptionsByName = (wilayaName: string) => {
    const communes = context.getCommunesByWilayaName(wilayaName);
    return communes.map(commune => ({
      value: commune.commune_name_ascii,
      label: commune.commune_name_ascii,
      arLabel: commune.commune_name,
    }));
  };

  const getWilayaInfo = (wilayaCode: string): Wilaya | undefined => {
    return context.getWilayaByCode(wilayaCode);
  };

  return {
    // Raw data
    wilayas: context.wilayas,
    communes: context.communes,
    
    // Utility functions
    getWilayaByCode: context.getWilayaByCode,
    getCommunesByWilayaCode: context.getCommunesByWilayaCode,
    getWilayaNameByCode: context.getWilayaNameByCode,
    getCommuneNameById: context.getCommuneNameById,
    
    // Form options
    wilayaOptions,
    getCommuneOptions,
    getCommuneOptionsByName,
    getWilayaInfo,
  };
}
