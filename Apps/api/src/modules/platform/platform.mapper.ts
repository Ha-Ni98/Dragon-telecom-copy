import type { Commune, Prisma, Wilaya } from '@prisma/client';
import {
  AdminFeesResponseSchema,
  FeeResponseSchema,
  PublicSettingsResponseSchema,
  SettingsResponseSchema,
  WilayaResponseSchema,
  type AdminFeesDto,
  type FeeDto,
  type FeeSource,
  type PublicSettingsDto,
  type SettingsDto,
  type WilayaDto,
} from '@dragon-telecom/contract';
import { DEFAULT_SETTINGS } from '../../../prisma/settings-defaults';

type Money = Prisma.Decimal | number;
type WilayaWithCommunes = Wilaya & { communes: Commune[] };
type SettingRow = { key: string; value: string };
type AdminFeesFeeInput = { wilayaId: string; communeId: string | null; deliveryHome: Money; deliveryOffice: Money };

export class PlatformMapper {
  static toWilayaDto(wilaya: WilayaWithCommunes): WilayaDto {
    const dto: WilayaDto = {
      id: wilaya.id,
      wilayaCode: wilaya.wilayaCode,
      frName: wilaya.frName,
      arName: wilaya.arName,
      communes: wilaya.communes.map((commune) => ({
        id: commune.id,
        communeCode: commune.communeCode,
        frName: commune.frName,
        arName: commune.arName,
      })),
    };
    return WilayaResponseSchema.parse(dto);
  }

  static toFeeDto(deliveryHome: Money, deliveryOffice: Money, source: FeeSource): FeeDto {
    const dto: FeeDto = {
      deliveryHome: PlatformMapper.toMoney(deliveryHome),
      deliveryOffice: PlatformMapper.toMoney(deliveryOffice),
      source,
    };
    return FeeResponseSchema.parse(dto);
  }

  // Merges over DEFAULT_SETTINGS section-by-section — a row is either entirely absent (use the
  // default section) or entirely present (a valid, previously-written section); see
  // plan-platform.md §1.2. Keeps `getSettings` valid even against an unseeded/partially-seeded DB.
  static toSettingsDto(rows: SettingRow[]): SettingsDto {
    const byKey = new Map(rows.map((row) => [row.key, JSON.parse(row.value) as unknown]));
    const dto: SettingsDto = {
      store: (byKey.get('store') as SettingsDto['store'] | undefined) ?? DEFAULT_SETTINGS.store,
      invoicing: (byKey.get('invoicing') as SettingsDto['invoicing'] | undefined) ?? DEFAULT_SETTINGS.invoicing,
      delivery: (byKey.get('delivery') as SettingsDto['delivery'] | undefined) ?? DEFAULT_SETTINGS.delivery,
      // Field-wise, unlike the other three sections: `storefront` gained `featuredFamilyIds` in
      // S15, and any row written before that carries only `featuredProductIds` — a whole-section
      // fallback would let that stale row through and fail SettingsResponseSchema.parse below.
      storefront: {
        ...DEFAULT_SETTINGS.storefront,
        ...((byKey.get('storefront') as Partial<SettingsDto['storefront']> | undefined) ?? {}),
      },
    };
    return SettingsResponseSchema.parse(dto);
  }

  // SETTINGS_PUBLIC route note: "featured products and families only" — trims an already-assembled
  // SettingsDto down to the one public-safe section (store/invoicing/delivery stay internal).
  static toPublicSettingsDto(settings: SettingsDto): PublicSettingsDto {
    const dto: PublicSettingsDto = { storefront: settings.storefront };
    return PublicSettingsResponseSchema.parse(dto);
  }

  // Only communes with an explicit override row appear in `communes[]` (no optional fields on
  // that schema by design — see plan-platform.md §8.1); a wilaya with no fee row of its own
  // falls back to `defaults` (settings.delivery.defaultHome/defaultOffice).
  static toAdminFeesDto(
    wilayas: WilayaWithCommunes[],
    fees: AdminFeesFeeInput[],
    defaults: { defaultHome: number; defaultOffice: number },
  ): AdminFeesDto {
    const feeByKey = new Map(fees.map((fee) => [`${fee.wilayaId}:${fee.communeId ?? ''}`, fee]));

    const dto: AdminFeesDto = {
      wilayas: wilayas.map((wilaya) => {
        const wilayaFee = feeByKey.get(`${wilaya.id}:`);
        return {
          wilayaId: wilaya.id,
          wilayaCode: wilaya.wilayaCode,
          frName: wilaya.frName,
          arName: wilaya.arName,
          deliveryHome: wilayaFee ? PlatformMapper.toMoney(wilayaFee.deliveryHome) : defaults.defaultHome,
          deliveryOffice: wilayaFee ? PlatformMapper.toMoney(wilayaFee.deliveryOffice) : defaults.defaultOffice,
          communes: wilaya.communes.flatMap((commune) => {
            const communeFee = feeByKey.get(`${wilaya.id}:${commune.id}`);
            if (!communeFee) return [];
            return [
              {
                communeId: commune.id,
                communeCode: commune.communeCode,
                frName: commune.frName,
                arName: commune.arName,
                deliveryHome: PlatformMapper.toMoney(communeFee.deliveryHome),
                deliveryOffice: PlatformMapper.toMoney(communeFee.deliveryOffice),
              },
            ];
          }),
        };
      }),
    };
    return AdminFeesResponseSchema.parse(dto);
  }

  private static toMoney(value: Money): number {
    return typeof value === 'number' ? value : value.toNumber();
  }
}
