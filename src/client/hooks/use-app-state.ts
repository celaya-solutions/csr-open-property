import { useCallback, useMemo, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { InferRequestType, InferResponseType } from "hono/client";
import { rpc, unwrap } from "@/lib/rpc";
import { invalidateAll, keys, useProperties, useSettingsQuery, useVendors } from "./queries";
import type {
  Lease, NewLease, NewProperty, NewTenant, NewUnit, NewVendor, NewWorkOrder,
  Property, RentCharge, Tenant, Unit, Vendor, WorkOrder,
} from "@/types";

export interface AppSettings {
  default_rent_due_day: number;
  late_fee_amount: number;
  late_fee_grace_days: number;
  currency: string;
}

const DEFAULT_SETTINGS: AppSettings = {
  default_rent_due_day: 1,
  late_fee_amount: 50,
  late_fee_grace_days: 5,
  currency: "USD",
};

function parseSettings(raw: Record<string, string>): AppSettings {
  const num = (key: keyof AppSettings, fallback: number) => {
    const v = parseFloat(raw[key]);
    return Number.isFinite(v) ? v : fallback;
  };
  return {
    default_rent_due_day: num("default_rent_due_day", DEFAULT_SETTINGS.default_rent_due_day),
    late_fee_amount: num("late_fee_amount", DEFAULT_SETTINGS.late_fee_amount),
    late_fee_grace_days: num("late_fee_grace_days", DEFAULT_SETTINGS.late_fee_grace_days),
    currency: raw.currency || DEFAULT_SETTINGS.currency,
  };
}

// Body types come from the server's Zod schemas by way of the RPC client.
type PropertyBody = InferRequestType<typeof rpc.api.properties.$post>["json"];
type UnitBody = InferRequestType<typeof rpc.api.units.$post>["json"];
type TenantBody = InferRequestType<typeof rpc.api.tenants.$post>["json"];
type LeaseBody = InferRequestType<typeof rpc.api.leases.$post>["json"];
type VendorBody = InferRequestType<typeof rpc.api.vendors.$post>["json"];
type WorkOrderBody = InferRequestType<(typeof rpc.api)["work-orders"]["$post"]>["json"];
type PaymentBody = InferRequestType<typeof rpc.api.payments.$post>["json"];

type CreatedProperty = InferResponseType<typeof rpc.api.properties.$post, 201>;
type UpdatedProperty = InferResponseType<(typeof rpc.api.properties)[":id"]["$put"], 200>;
type CreatedUnit = InferResponseType<typeof rpc.api.units.$post, 201>;
type UpdatedUnit = InferResponseType<(typeof rpc.api.units)[":id"]["$put"], 200>;
type CreatedTenant = InferResponseType<typeof rpc.api.tenants.$post, 201>;
type UpdatedTenant = InferResponseType<(typeof rpc.api.tenants)[":id"]["$put"], 200>;
type CreatedLease = InferResponseType<typeof rpc.api.leases.$post, 201>;
type UpdatedLease = InferResponseType<(typeof rpc.api.leases)[":id"]["$put"], 200>;
type CreatedVendor = InferResponseType<typeof rpc.api.vendors.$post, 201>;
type UpdatedVendor = InferResponseType<(typeof rpc.api.vendors)[":id"]["$put"], 200>;
type CreatedWorkOrder = InferResponseType<(typeof rpc.api)["work-orders"]["$post"], 201>;
type UpdatedWorkOrder = InferResponseType<(typeof rpc.api)["work-orders"][":id"]["$put"], 200>;
type GeneratedCharges = InferResponseType<(typeof rpc.api)["rent-charges"]["generate"]["$post"], 200>;
type PaidCharge = InferResponseType<typeof rpc.api.payments.$post, 201>;
type SettingsRes = InferResponseType<typeof rpc.api.settings.$put, 200>;

const id = (n: number) => ({ param: { id: String(n) } });

export function useAppState() {
  const qc = useQueryClient();
  const propertiesQuery = useProperties();
  const vendorsQuery = useVendors();
  const settingsQuery = useSettingsQuery();
  const [error, setError] = useState<string | null>(null);

  const settings = useMemo(
    () => parseSettings(settingsQuery.data ?? {}),
    [settingsQuery.data],
  );

  // Every write goes through here: run it, then let the cache refill itself.
  const write = useCallback(
    async <T,>(fn: () => Promise<T>): Promise<T> => {
      const result = await fn();
      await invalidateAll(qc);
      return result;
    },
    [qc],
  );

  const settingsMutation = useMutation({
    mutationFn: (patch: Partial<AppSettings>) => {
      const body: Record<string, string> = {};
      for (const [k, v] of Object.entries(patch)) {
        if (v !== undefined) body[k] = String(v);
      }
      return unwrap<SettingsRes>(rpc.api.settings.$put({ json: body }));
    },
    onSuccess: (res) => qc.setQueryData(keys.settings, res.settings),
  });

  const updateSettings = useCallback(
    async (patch: Partial<AppSettings>) => { await settingsMutation.mutateAsync(patch); },
    [settingsMutation],
  );

  // ── Properties ───────────────────────────────────────────────────

  const createProperty = useCallback((data: NewProperty) => write(async () =>
    (await unwrap<CreatedProperty>(rpc.api.properties.$post({ json: data as PropertyBody }))).property as Property,
  ), [write]);

  const updateProperty = useCallback((n: number, patch: Partial<NewProperty>) => write(async () =>
    (await unwrap<UpdatedProperty>(rpc.api.properties[":id"].$put({ ...id(n), json: patch as Partial<PropertyBody> }))).property as Property,
  ), [write]);

  const deleteProperty = useCallback((n: number) => write(async () => {
    await unwrap(rpc.api.properties[":id"].$delete(id(n)));
  }), [write]);

  // ── Units ────────────────────────────────────────────────────────

  const createUnit = useCallback((data: NewUnit) => write(async () =>
    (await unwrap<CreatedUnit>(rpc.api.units.$post({ json: data as UnitBody }))).unit as Unit,
  ), [write]);

  const updateUnit = useCallback((n: number, patch: Partial<NewUnit>) => write(async () =>
    (await unwrap<UpdatedUnit>(rpc.api.units[":id"].$put({ ...id(n), json: patch as Partial<UnitBody> }))).unit as Unit,
  ), [write]);

  const deleteUnit = useCallback((n: number) => write(async () => {
    await unwrap(rpc.api.units[":id"].$delete(id(n)));
  }), [write]);

  // ── Tenants ──────────────────────────────────────────────────────

  const createTenant = useCallback((data: NewTenant) => write(async () =>
    (await unwrap<CreatedTenant>(rpc.api.tenants.$post({ json: data as TenantBody }))).tenant as Tenant,
  ), [write]);

  const updateTenant = useCallback((n: number, patch: Partial<NewTenant>) => write(async () =>
    (await unwrap<UpdatedTenant>(rpc.api.tenants[":id"].$put({ ...id(n), json: patch as Partial<TenantBody> }))).tenant as Tenant,
  ), [write]);

  const deleteTenant = useCallback((n: number) => write(async () => {
    await unwrap(rpc.api.tenants[":id"].$delete(id(n)));
  }), [write]);

  // ── Leases ───────────────────────────────────────────────────────

  const createLease = useCallback((data: NewLease) => write(async () =>
    (await unwrap<CreatedLease>(rpc.api.leases.$post({ json: data as LeaseBody }))).lease as Lease,
  ), [write]);

  const updateLease = useCallback((n: number, patch: Partial<NewLease>) => write(async () =>
    (await unwrap<UpdatedLease>(rpc.api.leases[":id"].$put({ ...id(n), json: patch as Partial<LeaseBody> }))).lease as Lease,
  ), [write]);

  const deleteLease = useCallback((n: number) => write(async () => {
    await unwrap(rpc.api.leases[":id"].$delete(id(n)));
  }), [write]);

  // ── Rent ─────────────────────────────────────────────────────────

  const generateCharges = useCallback((period: string) => write(() =>
    unwrap<GeneratedCharges>(rpc.api["rent-charges"].generate.$post({ json: { period } })),
  ), [write]);

  const recordPayment = useCallback((input: PaymentBody) => write(async () => {
    const res = await unwrap<PaidCharge>(rpc.api.payments.$post({ json: input }));
    await qc.invalidateQueries({ queryKey: keys.payments(input.charge_id) });
    return res.charge as RentCharge;
  }), [write, qc]);

  // ── Vendors ──────────────────────────────────────────────────────

  const createVendor = useCallback((data: NewVendor) => write(async () =>
    (await unwrap<CreatedVendor>(rpc.api.vendors.$post({ json: data as VendorBody }))).vendor as Vendor,
  ), [write]);

  const updateVendor = useCallback((n: number, patch: Partial<NewVendor>) => write(async () =>
    (await unwrap<UpdatedVendor>(rpc.api.vendors[":id"].$put({ ...id(n), json: patch as Partial<VendorBody> }))).vendor as Vendor,
  ), [write]);

  const deleteVendor = useCallback((n: number) => write(async () => {
    await unwrap(rpc.api.vendors[":id"].$delete(id(n)));
  }), [write]);

  // ── Work orders ──────────────────────────────────────────────────

  const createWorkOrder = useCallback((data: NewWorkOrder) => write(async () =>
    (await unwrap<CreatedWorkOrder>(rpc.api["work-orders"].$post({ json: data as WorkOrderBody }))).work_order as WorkOrder,
  ), [write]);

  const updateWorkOrder = useCallback((n: number, patch: Partial<NewWorkOrder>) => write(async () =>
    (await unwrap<UpdatedWorkOrder>(rpc.api["work-orders"][":id"].$put({ ...id(n), json: patch as Partial<WorkOrderBody> }))).work_order as WorkOrder,
  ), [write]);

  const deleteWorkOrder = useCallback((n: number) => write(async () => {
    await unwrap(rpc.api["work-orders"][":id"].$delete(id(n)));
  }), [write]);

  return {
    // data
    properties: (propertiesQuery.data ?? []) as Property[],
    vendors: (vendorsQuery.data ?? []) as Vendor[],
    settings,
    loading: propertiesQuery.isLoading || vendorsQuery.isLoading || settingsQuery.isLoading,
    error: error ?? (propertiesQuery.error as Error | null)?.message ?? null,
    setError,
    // settings
    updateSettings,
    // properties / units
    createProperty, updateProperty, deleteProperty,
    createUnit, updateUnit, deleteUnit,
    // tenants
    createTenant, updateTenant, deleteTenant,
    // leases
    createLease, updateLease, deleteLease,
    // rent
    generateCharges, recordPayment,
    // vendors
    createVendor, updateVendor, deleteVendor,
    // work orders
    createWorkOrder, updateWorkOrder, deleteWorkOrder,
  };
}

export type AppStateValue = ReturnType<typeof useAppState>;
