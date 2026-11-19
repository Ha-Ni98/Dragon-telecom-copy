import type { Commune, HeroSlide, Prisma, Wilaya } from '@prisma/client';
import {
  AdminFeesResponseSchema,
  FeeResponseSchema,
  HeroSlideResponseSchema,
  HeroSlideTextSchema,
  PublicHeroSlideResponseSchema,
  PublicSettingsResponseSchema,
  SettingsResponseSchema,
  WilayaResponseSchema,
  type AdminFeesDto,
  type FeeDto,
  type FeeSource,
  type HeroSlideDto,
  type PublicHeroSlideDto,
  type PublicSettingsDto,
  type SettingsDto,
  type WilayaDto,
  storeLocalDate,
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

  // SETTINGS_PUBLIC — the public-safe subset of an already-assembled SettingsDto. S25 added
  // `store` (see the schema comment in platform.dtos.ts for why the shop header is public);
  // `invoicing` and `delivery` remain internal.
  static toPublicSettingsDto(settings: SettingsDto): PublicSettingsDto {
    const dto: PublicSettingsDto = { store: settings.store, storefront: settings.storefront };
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

  // S38 — startsAt/endsAt are stored as UTC instants of store-day bounds (endsAt exclusive); the
  // admin form edits store-local days, endsOn inclusive — hence the 1 ms step back.
  static toHeroSlideDto(slide: HeroSlide, now: Date): HeroSlideDto {
    const dto: HeroSlideDto = {
      id: slide.id,
      desktopImageUrl: slide.desktopImageUrl,
      desktopImageKey: slide.desktopImageKey,
      mobileImageUrl: slide.mobileImageUrl,
      mobileImageKey: slide.mobileImageKey,
      text: HeroSlideTextSchema.parse(slide.text),
      link: slide.link,
      isActive: slide.isActive,
      ...(slide.startsAt ? { startsOn: storeLocalDate(slide.startsAt) } : {}),
      ...(slide.endsAt ? { endsOn: storeLocalDate(new Date(slide.endsAt.getTime() - 1)) } : {}),
      displayOrder: slide.displayOrder,
      isLive:
        slide.isActive &&
        (slide.startsAt == null || slide.startsAt <= now) &&
        (slide.endsAt == null || slide.endsAt > now),
    };
    return HeroSlideResponseSchema.parse(dto);
  }

  static toPublicHeroSlideDto(slide: HeroSlide): PublicHeroSlideDto {
    return PublicHeroSlideResponseSchema.parse({
      id: slide.id,
      desktopImageUrl: slide.desktopImageUrl,
      mobileImageUrl: slide.mobileImageUrl,
      text: HeroSlideTextSchema.parse(slide.text),
      link: slide.link,
    });
  }

  private static toMoney(value: Money): number {
    return typeof value === 'number' ? value : value.toNumber();
  }
}
