import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type {
  FeeQuery,
  UpsertFeesCommand,
  FeesExportQuery,
  UpdateSettingsCommand,
  CreateHeroSlideCommand,
  UpdateHeroSlideCommand,
  ReorderHeroSlidesCommand,
  HeroSlideDto,
} from "@dragon-telecom/contract";
import * as platformService from "@/services/platform.service";
import { qk } from "@/lib/query-keys";

// Names prefixed to stay distinct from use-delivery-fees.ts (useAvailableWilayas/
// useCommunesForWilaya/useDeliveryFeeCalculation) and use-admin-settings.ts (useDeliveryFees/
// useImportDeliveryFees/useExportDeliveryFees) — both pre-existing Sub-01 stub surfaces still
// serving DeliveryForm.tsx / delivery-fees-section.tsx until Sub-03.

export function useWilayas() {
  return useQuery({
    queryKey: qk.platform.wilayas(),
    queryFn: platformService.listWilayas,
    staleTime: 30 * 60_000, // rarely changes
  });
}

export function usePlatformDeliveryFee(query: FeeQuery) {
  return useQuery({
    queryKey: qk.platform.fee(query),
    queryFn: () => platformService.getFee(query),
    enabled: !!query.wilayaId,
  });
}

export function useAdminDeliveryFees() {
  return useQuery({
    queryKey: qk.platform.adminFees(),
    queryFn: platformService.getAdminFees,
  });
}

export function useUpsertAdminDeliveryFees() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (command: UpsertFeesCommand) => platformService.upsertFees(command),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: qk.platform.adminFees() });
    },
  });
}

export function useImportAdminDeliveryFees() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (file: File) => platformService.importFees(file),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: qk.platform.adminFees() });
    },
  });
}

// Imperative (triggers a file download) rather than a query — exportFees returns a Blob, not
// cacheable domain data.
export function useExportAdminDeliveryFees() {
  return useMutation({
    mutationFn: (query: FeesExportQuery) => platformService.exportFees(query),
  });
}

export function usePlatformSettings() {
  return useQuery({
    queryKey: qk.platform.settings(),
    queryFn: platformService.getSettings,
  });
}

export function useUpdatePlatformSettings() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (command: UpdateSettingsCommand) => platformService.updateSettings(command),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: qk.platform.settings() });
      // Settings changes (e.g. featured products) are also visible on the public storefront.
      queryClient.invalidateQueries({ queryKey: qk.platform.publicSettings() });
    },
  });
}

export function usePublicSettings() {
  return useQuery({
    queryKey: qk.platform.publicSettings(),
    queryFn: platformService.getPublicSettings,
  });
}

// --- S38 hero slides ---

export function usePublicHeroSlides() {
  return useQuery({
    queryKey: qk.platform.heroSlides.public(),
    queryFn: platformService.listPublicHeroSlides,
    staleTime: 5 * 60_000,
  });
}

export function useAdminHeroSlides() {
  return useQuery({
    queryKey: qk.platform.heroSlides.admin(),
    queryFn: platformService.listAdminHeroSlides,
  });
}

// Every admin mutation returns the full ordered list, so it seeds the admin cache directly (the
// panel re-renders the true order at once) and invalidates the public one the storefront reads.
function useHeroSlidesMutation<TVars>(mutationFn: (vars: TVars) => Promise<HeroSlideDto[]>) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn,
    onSuccess: (slides) => {
      queryClient.setQueryData(qk.platform.heroSlides.admin(), slides);
      queryClient.invalidateQueries({ queryKey: qk.platform.heroSlides.public() });
    },
  });
}

export const useCreateHeroSlide = () =>
  useHeroSlidesMutation((command: CreateHeroSlideCommand) =>
    platformService.createHeroSlide(command),
  );

export const useUpdateHeroSlide = () =>
  useHeroSlidesMutation(({ id, command }: { id: string; command: UpdateHeroSlideCommand }) =>
    platformService.updateHeroSlide(id, command),
  );

export const useDeleteHeroSlide = () =>
  useHeroSlidesMutation((id: string) => platformService.deleteHeroSlide(id));

export const useReorderHeroSlides = () =>
  useHeroSlidesMutation((command: ReorderHeroSlidesCommand) =>
    platformService.reorderHeroSlides(command),
  );
