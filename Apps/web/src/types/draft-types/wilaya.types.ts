// Algeria Wilaya and Commune types

export interface Wilaya {
  id: string;
  code: string;
  name: string;
  ar_name: string;
  longitude: string;
  latitude: string;
}

export interface Commune {
  id: number;
  commune_name_ascii: string;
  commune_name: string;
  daira_name_ascii: string;
  daira_name: string;
  wilaya_code: string;
  wilaya_name_ascii: string;
  wilaya_name: string;
}

export interface WilayaContextValue {
  wilayas: Wilaya[];
  communes: Commune[];
  getWilayaByCode: (code: string) => Wilaya | undefined;
  getCommunesByWilayaCode: (wilayaCode: string) => Commune[];
  getWilayaNameByCode: (code: string) => string;
  getCommuneNameById: (id: number) => string;
  getCommunesByWilayaName: (wilayaName: string) => Commune[];
}
