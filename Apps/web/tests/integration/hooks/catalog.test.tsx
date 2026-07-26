import { describe, it, expect } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { http } from "msw";
import { server } from "../../fixtures/msw/server";
import { catalogUrls, catalogErrorHandlers } from "../../fixtures/msw/catalog.handlers";
import { ok } from "../../fixtures/msw/envelope";
import { createQueryWrapper } from "../../fixtures/wrappers/createQueryWrapper";
import {
  mockProductsPaginated,
  mockProductDetail,
  mockStaffProductsPaginated,
  mockAdminProductsPaginated,
  mockAdminProduct,
  mockProductStats,
  mockBrand,
  mockFamily,
  mockModel,
  mockClientCategory,
} from "../../fixtures/data/catalog.mock";
import {
  useCatalogProducts,
  useCatalogProduct,
  useStaffProducts,
  useAdminCatalogProducts,
  useAdminCatalogProduct,
  useProductStats,
  useCreateProduct,
  useUpdateProduct,
} from "@/hooks/useCatalogProducts";
import {
  useCatalogBrands,
  useCreateCatalogBrand,
  useCatalogFamilies,
  useCatalogModels,
} from "@/hooks/useCatalogTaxonomy";
import {
  useCatalogClientCategories,
  useCreateCatalogClientCategory,
} from "@/hooks/useClientCategories";

describe("useCatalogProducts / useCatalogProduct", () => {
  it("resolves the paginated product list", async () => {
    const { result } = renderHook(() => useCatalogProducts({ page: 1, limit: 15 }), {
      wrapper: createQueryWrapper(),
    });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual(mockProductsPaginated);
  });

  it("resolves a single product detail", async () => {
    const { result } = renderHook(() => useCatalogProduct(mockProductDetail.id), {
      wrapper: createQueryWrapper(),
    });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual(mockProductDetail);
  });

  it("surfaces an error state on 404", async () => {
    server.use(catalogErrorHandlers.productDetailNotFound());
    const { result } = renderHook(() => useCatalogProduct("missing"), {
      wrapper: createQueryWrapper(),
    });
    await waitFor(() => expect(result.current.isError).toBe(true));
  });

  it("stays disabled (no fetch) when id is empty", () => {
    const { result } = renderHook(() => useCatalogProduct(""), { wrapper: createQueryWrapper() });
    expect(result.current.isPending).toBe(true);
    expect(result.current.fetchStatus).toBe("idle");
  });
});

describe("useStaffProducts / useAdminCatalogProducts / useAdminCatalogProduct", () => {
  it("resolves the staff-scoped paginated list", async () => {
    const { result } = renderHook(() => useStaffProducts({ page: 1, limit: 20 }), {
      wrapper: createQueryWrapper(),
    });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual(mockStaffProductsPaginated);
  });

  it("resolves the admin-scoped paginated list and a single admin detail", async () => {
    const { result: listResult } = renderHook(
      () => useAdminCatalogProducts({ page: 1, limit: 20 }),
      {
        wrapper: createQueryWrapper(),
      },
    );
    await waitFor(() => expect(listResult.current.isSuccess).toBe(true));
    expect(listResult.current.data).toEqual(mockAdminProductsPaginated);

    const { result: detailResult } = renderHook(() => useAdminCatalogProduct(mockAdminProduct.id), {
      wrapper: createQueryWrapper(),
    });
    await waitFor(() => expect(detailResult.current.isSuccess).toBe(true));
    expect(detailResult.current.data).toEqual(mockAdminProduct);
  });
});

describe("useProductStats", () => {
  it("resolves the stats DTO", async () => {
    const { result } = renderHook(() => useProductStats(), { wrapper: createQueryWrapper() });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual(mockProductStats);
  });
});

describe("useCreateProduct / useUpdateProduct — mutation shape + invalidation", () => {
  it("exposes mutate/isPending and invalidates the still-mounted admin product list on success", async () => {
    const wrapper = createQueryWrapper();
    let adminListCalls = 0;
    server.use(
      http.get(catalogUrls.adminProducts, () => {
        adminListCalls += 1;
        return ok(mockAdminProductsPaginated);
      }),
    );

    const { result: listResult } = renderHook(
      () => useAdminCatalogProducts({ page: 1, limit: 20 }),
      { wrapper },
    );
    await waitFor(() => expect(listResult.current.isSuccess).toBe(true));
    expect(adminListCalls).toBe(1);

    const { result: createResult } = renderHook(() => useCreateProduct(), { wrapper });
    expect(createResult.current.isPending).toBe(false);
    createResult.current.mutate({
      command: { name: "New", newFamilyName: "F", newBrandName: "B", initialQuantity: 0 },
      images: [],
    });
    await waitFor(() => expect(createResult.current.isSuccess).toBe(true));
    expect(createResult.current.data).toEqual(mockAdminProduct);

    // Invalidation triggers a refetch of the still-mounted, active admin list query.
    await waitFor(() => expect(adminListCalls).toBe(2));
  });

  it("useUpdateProduct exposes mutate/isPending and returns the updated DTO", async () => {
    const { result } = renderHook(() => useUpdateProduct(), { wrapper: createQueryWrapper() });
    expect(result.current.isPending).toBe(false);
    result.current.mutate({ id: mockAdminProduct.id, command: { name: "Renamed" } });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual(mockAdminProduct);
  });
});

describe("useCatalogBrands / useCreateCatalogBrand", () => {
  it("resolves the brand list and invalidates on create", async () => {
    const wrapper = createQueryWrapper();
    const { result: brandsResult } = renderHook(() => useCatalogBrands(), { wrapper });
    await waitFor(() => expect(brandsResult.current.isSuccess).toBe(true));
    expect(brandsResult.current.data).toEqual([mockBrand]);

    const { result: createResult } = renderHook(() => useCreateCatalogBrand(), { wrapper });
    createResult.current.mutate({ name: "Apple" });
    await waitFor(() => expect(createResult.current.isSuccess).toBe(true));
    expect(createResult.current.data).toEqual(mockBrand);
  });
});

describe("useCatalogFamilies / useCatalogModels", () => {
  it("resolves families and models", async () => {
    const { result: familiesResult } = renderHook(() => useCatalogFamilies(), {
      wrapper: createQueryWrapper(),
    });
    await waitFor(() => expect(familiesResult.current.isSuccess).toBe(true));
    expect(familiesResult.current.data).toEqual([mockFamily]);

    const { result: modelsResult } = renderHook(() => useCatalogModels(), {
      wrapper: createQueryWrapper(),
    });
    await waitFor(() => expect(modelsResult.current.isSuccess).toBe(true));
    expect(modelsResult.current.data).toEqual([mockModel]);
  });
});

describe("useCatalogClientCategories / useCreateCatalogClientCategory", () => {
  it("resolves categories and invalidates on create", async () => {
    const wrapper = createQueryWrapper();
    const { result: categoriesResult } = renderHook(() => useCatalogClientCategories(), {
      wrapper,
    });
    await waitFor(() => expect(categoriesResult.current.isSuccess).toBe(true));
    expect(categoriesResult.current.data).toEqual([mockClientCategory]);

    const { result: createResult } = renderHook(() => useCreateCatalogClientCategory(), {
      wrapper,
    });
    createResult.current.mutate({ name: "Wholesalers" });
    await waitFor(() => expect(createResult.current.isSuccess).toBe(true));
    expect(createResult.current.data).toEqual(mockClientCategory);
  });

  it("surfaces an error state on a 409 name conflict", async () => {
    server.use(catalogErrorHandlers.categoryConflict());
    const { result } = renderHook(() => useCreateCatalogClientCategory(), {
      wrapper: createQueryWrapper(),
    });
    result.current.mutate({ name: "Repair Shops" });
    await waitFor(() => expect(result.current.isError).toBe(true));
  });
});
