import {
  WilayaResponseSchema,
  FeeResponseSchema,
  SettingsResponseSchema,
  PublicSettingsResponseSchema,
  AdminFeesResponseSchema,
  DocType,
  FeeSource,
  type WilayaDto,
  type FeeDto,
  type SettingsDto,
  type PublicSettingsDto,
  type AdminFeesDto,
} from "@dragon-telecom/contract";

export const mockWilaya: WilayaDto = WilayaResponseSchema.parse({
  id: "aa000000-0000-4000-8000-000000000010",
  wilayaCode: "16",
  frName: "Alger",
  arName: "الجزائر",
  communes: [
    {
      id: "aa000000-0000-4000-8000-000000000020",
      communeCode: "1601",
      frName: "Bab Ezzouar",
      arName: "باب الزوار",
    },
  ],
});

export const mockWilayas: WilayaDto[] = [mockWilaya];

// Falls back to the settings default when no DeliveryFee row exists for this wilaya/commune.
export const mockFeeDefault: FeeDto = FeeResponseSchema.parse({
  deliveryHome: 500,
  deliveryOffice: 300,
  source: FeeSource.DEFAULT,
});

// An explicit wilaya/commune override — the other pole of FeeDto.source.
export const mockFeeOverride: FeeDto = FeeResponseSchema.parse({
  deliveryHome: 700,
  deliveryOffice: 400,
  source: FeeSource.COMMUNE,
});

const PREFIXES = Object.fromEntries(
  Object.values(DocType).map((type) => [type, type.slice(0, 3)]),
) as Record<DocType, string>;
const NEXT_SEQUENCES = Object.fromEntries(
  Object.values(DocType).map((type) => [type, 1]),
) as Record<DocType, number>;

export const mockSettings: SettingsDto = SettingsResponseSchema.parse({
  store: { name: "Dragon Telecom" },
  invoicing: { prefixes: PREFIXES, nextSequences: NEXT_SEQUENCES },
  delivery: { defaultHome: 500, defaultOffice: 300 },
  storefront: { featuredProductIds: [] },
});

export const mockPublicSettings: PublicSettingsDto = PublicSettingsResponseSchema.parse({
  storefront: { featuredProductIds: [] },
});

export const mockAdminFees: AdminFeesDto = AdminFeesResponseSchema.parse({
  wilayas: [
    {
      wilayaId: mockWilaya.id,
      wilayaCode: mockWilaya.wilayaCode,
      frName: mockWilaya.frName,
      arName: mockWilaya.arName,
      deliveryHome: 500,
      deliveryOffice: 300,
      communes: [
        {
          communeId: mockWilaya.communes[0].id,
          communeCode: mockWilaya.communes[0].communeCode,
          frName: mockWilaya.communes[0].frName,
          arName: mockWilaya.communes[0].arName,
          deliveryHome: 700,
          deliveryOffice: 400,
        },
      ],
    },
  ],
});
