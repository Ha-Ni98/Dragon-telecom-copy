import { describe, it, expect } from "vitest";
import { http } from "msw";
import { server } from "../../fixtures/msw/server";
import { catalogUrls, catalogErrorHandlers } from "../../fixtures/msw/catalog.handlers";
import { ok } from "../../fixtures/msw/envelope";
import {
  mockProductsPaginated,
  mockProductDetail,
  mockStaffProductsPaginated,
  mockAdminProductsPaginated,
  mockAdminProduct,
  mockProductStats,
  mockBrand,
  mockFamily,
  mockFamilyWithCount,
  mockModel,
  mockClientCategory,
} from "../../fixtures/data/catalog.mock";
import * as catalogService from "@/services/catalog.service";

describe("catalog.service — public/staff reads", () => {
  it("listProducts returns the unwrapped paginated DTO", async () => {
    const result = await catalogService.listProducts({ page: 1, limit: 15 });
    expect(result).toEqual(mockProductsPaginated);
    expect(result.items).toHaveLength(2);
    expect(result.meta).toEqual(mockProductsPaginated.meta);
  });

  it("getProduct returns the unwrapped detail DTO", async () => {
    const result = await catalogService.getProduct(mockProductDetail.id);
    expect(result).toEqual(mockProductDetail);
  });

  it("getProduct throws on 404", async () => {
    server.use(catalogErrorHandlers.productDetailNotFound());
    await expect(catalogService.getProduct("missing")).rejects.toMatchObject({
      response: { status: 404 },
    });
  });

  it("listStaffProducts returns the unwrapped paginated DTO", async () => {
    const result = await catalogService.listStaffProducts({ page: 1, limit: 20 });
    expect(result).toEqual(mockStaffProductsPaginated);
  });
});

describe("catalog.service — admin products", () => {
  it("listAdminProducts returns the unwrapped paginated DTO", async () => {
    const result = await catalogService.listAdminProducts({ page: 1, limit: 20 });
    expect(result).toEqual(mockAdminProductsPaginated);
  });

  it("listAdminProducts throws on 500", async () => {
    server.use(catalogErrorHandlers.adminProductsServerError());
    await expect(catalogService.listAdminProducts({ page: 1, limit: 20 })).rejects.toMatchObject({
      response: { status: 500 },
    });
  });

  it("createProduct sends a multipart body with stringified fields and appended files", async () => {
    let seenContentType: string | null = null;
    let seenName: FormDataEntryValue | null = null;
    let seenQuantity: FormDataEntryValue | null = null;
    let seenFileCount = 0;
    server.use(
      http.post(catalogUrls.adminProducts, async ({ request }) => {
        seenContentType = request.headers.get("content-type");
        const body = await request.formData();
        seenName = body.get("name");
        seenQuantity = body.get("initialQuantity");
        seenFileCount = body.getAll("images").length;
        return ok(mockAdminProduct, 201);
      }),
    );

    const file = new File(["binary"], "photo.jpg", { type: "image/jpeg" });
    const result = await catalogService.createProduct(
      {
        name: "New Screen",
        newFamilyName: "Screens",
        newBrandName: "Samsung",
        initialQuantity: 5,
        initialUnitCost: 1000,
      },
      [file],
    );

    expect(result).toEqual(mockAdminProduct);
    expect(seenContentType).toMatch(/^multipart\/form-data/);
    expect(seenName).toBe("New Screen");
    expect(seenQuantity).toBe("5");
    expect(seenFileCount).toBe(1);
  });

  it("createProduct throws on a validation error (e.g. the familyId/newFamilyName XOR)", async () => {
    server.use(catalogErrorHandlers.createProductValidationError());
    await expect(
      catalogService.createProduct(
        { name: "X", newFamilyName: "Y", newBrandName: "Z", initialQuantity: 0 },
        [],
      ),
    ).rejects.toMatchObject({ response: { status: 400 } });
  });

  it("getAdminProduct throws on 404", async () => {
    server.use(catalogErrorHandlers.adminProductNotFound());
    await expect(catalogService.getAdminProduct("missing")).rejects.toMatchObject({
      response: { status: 404 },
    });
  });

  it("updateProduct returns the unwrapped DTO", async () => {
    const result = await catalogService.updateProduct(mockAdminProduct.id, { name: "Renamed" });
    expect(result).toEqual(mockAdminProduct);
  });

  it("updatePricing returns the unwrapped DTO", async () => {
    const result = await catalogService.updatePricing(mockAdminProduct.id, {
      defaultSalePrice: 4600,
    });
    expect(result).toEqual(mockAdminProduct);
  });

  it("updatePricing throws on a validation error", async () => {
    server.use(catalogErrorHandlers.pricingValidationError());
    await expect(
      catalogService.updatePricing(mockAdminProduct.id, { defaultSalePrice: -1 }),
    ).rejects.toMatchObject({ response: { status: 400 } });
  });

  // DISCOVERED CONTRACT GAP (not a frontend fix — see catalog.service.ts's commandToFormData
  // comment): AddProductImagesCommand's own metadata field is named `images`, the same wire
  // name multer's `.array('images')` expects for the file blobs — the two collide under one
  // FormData key. This asserts the wire behavior as implemented (one JSON-stringified
  // metadata entry + one File entry, both under "images"), not a false 1-file expectation.
  it("addImages sends both the file and the (colliding) JSON metadata field under 'images'", async () => {
    let seenEntries: FormDataEntryValue[] = [];
    server.use(
      http.post(catalogUrls.images, async ({ request }) => {
        const body = await request.formData();
        seenEntries = body.getAll("images");
        return ok(mockAdminProduct, 201);
      }),
    );
    const file = new File(["binary"], "extra.jpg", { type: "image/jpeg" });
    const result = await catalogService.addImages(
      mockAdminProduct.id,
      { images: [{ isPrimary: false }] },
      [file],
    );
    expect(result).toEqual(mockAdminProduct);
    expect(seenEntries).toHaveLength(2);
    // Cross-realm `instanceof File` is unreliable under msw/node (File comes from Node's
    // buffer module here, not the same constructor jsdom exposes globally) — distinguish by
    // the one property that actually matters: a file entry is never a plain string.
    expect(seenEntries.some((entry) => typeof entry !== "string")).toBe(true);
    expect(
      seenEntries.some((entry) => typeof entry === "string" && entry.includes("isPrimary")),
    ).toBe(true);
  });

  it("updateImages returns the unwrapped DTO", async () => {
    const result = await catalogService.updateImages(mockAdminProduct.id, {
      images: [{ id: "1a000000-0000-4000-8000-000000000001", isPrimary: true }],
    });
    expect(result).toEqual(mockAdminProduct);
  });

  it("productStats returns the unwrapped DTO", async () => {
    const result = await catalogService.productStats();
    expect(result).toEqual(mockProductStats);
  });
});

describe("catalog.service — taxonomy (brands/families/models)", () => {
  it("listBrands hits the public route by default and the admin route when admin=true", async () => {
    let hitPublic = false;
    let hitAdmin = false;
    server.use(
      http.get(catalogUrls.brands, () => {
        hitPublic = true;
        return ok([mockBrand]);
      }),
      http.get(catalogUrls.adminBrands, () => {
        hitAdmin = true;
        return ok([mockBrand]);
      }),
    );
    await catalogService.listBrands();
    expect(hitPublic).toBe(true);
    await catalogService.listBrands(true);
    expect(hitAdmin).toBe(true);
  });

  it("createBrand / updateBrand return the unwrapped DTO", async () => {
    expect(await catalogService.createBrand({ name: "Apple" })).toEqual(mockBrand);
    expect(await catalogService.updateBrand(mockBrand.id, { name: "Apple Inc." })).toEqual(
      mockBrand,
    );
  });

  it("updateBrand throws on 404", async () => {
    server.use(catalogErrorHandlers.brandNotFound());
    await expect(catalogService.updateBrand("missing", { name: "X" })).rejects.toMatchObject({
      response: { status: 404 },
    });
  });

  it("listFamilies returns productCount only when withCount=true", async () => {
    const withoutCount = await catalogService.listFamilies({});
    expect(withoutCount[0].productCount).toBeUndefined();

    const withCount = await catalogService.listFamilies({ withCount: true });
    expect(withCount[0]).toEqual(mockFamilyWithCount);
  });

  it("createFamily / updateFamily return the unwrapped DTO", async () => {
    expect(await catalogService.createFamily({ name: "Batteries" })).toEqual(mockFamily);
    expect(await catalogService.updateFamily(mockFamily.id, { name: "Batteries v2" })).toEqual(
      mockFamily,
    );
  });

  it("updateFamily throws on 404", async () => {
    server.use(catalogErrorHandlers.familyNotFound());
    await expect(catalogService.updateFamily("missing", { name: "X" })).rejects.toMatchObject({
      response: { status: 404 },
    });
  });

  it("listModels / createModel / updateModel / setModelFamilies return the unwrapped DTO", async () => {
    expect(await catalogService.listModels()).toEqual([mockModel]);
    expect(await catalogService.createModel({ brandId: mockBrand.id, name: "Galaxy S22" })).toEqual(
      mockModel,
    );
    expect(await catalogService.updateModel(mockModel.id, { name: "Galaxy S22 Ultra" })).toEqual(
      mockModel,
    );
    expect(
      await catalogService.setModelFamilies(mockModel.id, { familyIds: [mockFamily.id] }),
    ).toEqual(mockModel);
  });

  it("updateModel throws on 404", async () => {
    server.use(catalogErrorHandlers.modelNotFound());
    await expect(catalogService.updateModel("missing", { name: "X" })).rejects.toMatchObject({
      response: { status: 404 },
    });
  });
});

describe("catalog.service — client categories", () => {
  it("listCategories / createCategory / updateCategory return the unwrapped DTO", async () => {
    expect(await catalogService.listCategories()).toEqual([mockClientCategory]);
    expect(await catalogService.createCategory({ name: "Wholesalers" })).toEqual(
      mockClientCategory,
    );
    expect(
      await catalogService.updateCategory(mockClientCategory.id, { name: "Wholesalers v2" }),
    ).toEqual(mockClientCategory);
  });

  it("createCategory throws on a name conflict (409)", async () => {
    server.use(catalogErrorHandlers.categoryConflict());
    await expect(catalogService.createCategory({ name: "Repair Shops" })).rejects.toMatchObject({
      response: { status: 409 },
    });
  });

  it("updateCategory throws on 404", async () => {
    server.use(catalogErrorHandlers.categoryNotFound());
    await expect(catalogService.updateCategory("missing", { name: "X" })).rejects.toMatchObject({
      response: { status: 404 },
    });
  });
});
