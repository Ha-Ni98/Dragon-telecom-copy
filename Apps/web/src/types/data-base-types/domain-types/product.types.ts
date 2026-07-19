// Types for Product domain

export interface Product {
  idProduct: number;
  productName: string;
  productDescription?: string | null;
  productCodeBar: string;
  productCreatedDate: string | Date;
  productStatue: number;
  productQuantity: number;
  productNoUserPrice?: number | null;
  idModel: number;
  idFamily: number;
}

// ProductPictures
export interface ProductPicture {
  idPicture: number;
  path: string;
  isPrimary: boolean;
  idProduct: number;
}

// ProductPriceCategory
export interface ProductPriceCategory {
  idProduct: number;
  idCategory: number;
  price: number;
}

// ProductHistoryPrice
export interface ProductHistoryPrice {
  idItem: number;
  idCategory: number;
  price: number;
  priceCreatedDate: string | Date;
}

// Model
export interface Model {
  idModel: number;
  idBrand: number;
  modelName: string;
}

// Brand
export interface Brand {
  idBrand: number;
  brandName: string;
}

// Family
export interface Family {
  idFamily: number;
  familyName: string;
}

// ModelFamily
export interface ModelFamily {
  idModel: number;
  idFamily: number;
}
