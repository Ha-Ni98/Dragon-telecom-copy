import { describe, it, expect } from "vitest";
import { server } from "../../fixtures/msw/server";
import { ordersErrorHandlers } from "../../fixtures/msw/orders.handlers";
import {
  mockOrderPickup,
  mockOrderDelivery,
  mockOrdersList,
  mockOrdersPaginated,
  mockOrderStats,
} from "../../fixtures/data/orders.mock";
import { mockProductWithPricing } from "../../fixtures/data/catalog.mock";
import * as ordersService from "@/services/orders.service";

describe("orders.service — client-facing", () => {
  it("placeOrder returns the unwrapped DTO", async () => {
    const result = await ordersService.placeOrder({
      productId: mockProductWithPricing.id,
      quantity: 1,
      orderType: "PICKUP" as never,
      contact: { fullName: "Amine Belkacem", phone: "0550000001" },
    });
    expect(result).toEqual(mockOrderPickup);
  });

  it("placeOrder throws on a validation error (delivery/PICKUP XOR)", async () => {
    server.use(ordersErrorHandlers.placeOrderValidationError());
    await expect(
      ordersService.placeOrder({
        productId: mockProductWithPricing.id,
        quantity: 1,
        orderType: "DELIVERY_HOME" as never,
        contact: { fullName: "X", phone: "0550000001" },
      }),
    ).rejects.toMatchObject({ response: { status: 400 } });
  });

  it("listMyOrders returns the unwrapped array (no pagination)", async () => {
    const result = await ordersService.listMyOrders({});
    expect(result).toEqual(mockOrdersList);
  });

  it("cancelMyOrder returns the unwrapped DTO", async () => {
    const result = await ordersService.cancelMyOrder(mockOrderPickup.id);
    expect(result).toEqual(mockOrderPickup);
  });

  it("cancelMyOrder throws on 404", async () => {
    server.use(ordersErrorHandlers.myCancelNotFound());
    await expect(ordersService.cancelMyOrder("missing")).rejects.toMatchObject({
      response: { status: 404 },
    });
  });
});

describe("orders.service — staff/admin pipeline", () => {
  it("listOrders returns the unwrapped paginated DTO for both scopes", async () => {
    expect(await ordersService.listOrders("staff", { page: 1, limit: 20 })).toEqual(
      mockOrdersPaginated,
    );
    expect(await ordersService.listOrders("admin", { page: 1, limit: 20 })).toEqual(
      mockOrdersPaginated,
    );
  });

  it("listOrders throws on 500", async () => {
    server.use(ordersErrorHandlers.adminListServerError());
    await expect(ordersService.listOrders("admin", { page: 1, limit: 20 })).rejects.toMatchObject({
      response: { status: 500 },
    });
  });

  it("confirmOrder returns the unwrapped DTO for both scopes", async () => {
    expect(await ordersService.confirmOrder("staff", mockOrderDelivery.id, {})).toEqual(
      mockOrderDelivery,
    );
    expect(await ordersService.confirmOrder("admin", mockOrderDelivery.id, {})).toEqual(
      mockOrderDelivery,
    );
  });

  it("confirmOrder throws on a conflict (already confirmed)", async () => {
    server.use(ordersErrorHandlers.confirmOrderConflict());
    await expect(
      ordersService.confirmOrder("admin", mockOrderDelivery.id, {}),
    ).rejects.toMatchObject({
      response: { status: 409 },
    });
  });

  it("updateOrderStatus returns the unwrapped DTO for both scopes", async () => {
    expect(
      await ordersService.updateOrderStatus("staff", mockOrderDelivery.id, {
        status: "PACKAGED" as never,
      }),
    ).toEqual(mockOrderDelivery);
    expect(
      await ordersService.updateOrderStatus("admin", mockOrderDelivery.id, {
        status: "PACKAGED" as never,
      }),
    ).toEqual(mockOrderDelivery);
  });

  it("adminCancelOrder returns the unwrapped DTO", async () => {
    const result = await ordersService.adminCancelOrder(mockOrderPickup.id, {
      reason: "customer request",
    });
    expect(result).toEqual(mockOrderPickup);
  });

  it("returnOrder returns the unwrapped DTO", async () => {
    const result = await ordersService.returnOrder(mockOrderDelivery.id, {
      quantity: 1,
      restock: true,
      refundAmount: 4500,
    });
    expect(result).toEqual(mockOrderDelivery);
  });

  it("orderStats returns the unwrapped DTO for both scopes", async () => {
    expect(await ordersService.orderStats("staff")).toEqual(mockOrderStats);
    expect(await ordersService.orderStats("admin")).toEqual(mockOrderStats);
  });
});
