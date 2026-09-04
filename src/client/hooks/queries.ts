import { useQuery, useQueryClient, type QueryClient } from "@tanstack/react-query";
import type { InferResponseType } from "hono/client";
import { rpc, unwrap } from "@/lib/rpc";
import type {
  DashboardSummary, Lease, Payment, Property, RentCharge, Tenant, Unit, Vendor, WorkOrder,
} from "@/types";

// ── Keys ───────────────────────────────────────────────────────────
// Every hook and every invalidation goes through this object, so a cache key
// can't drift between the two.

export const keys = {
  properties: ["properties"] as const,
  property: (id: number) => ["properties", id] as const,
  units: (filter: { property_id?: number } = {}) => ["units", filter] as const,
  tenants: (q?: string) => ["tenants", q ?? ""] as const,
  tenant: (id: number) => ["tenants", "one", id] as const,
  leases: (filter: LeaseFilter = {}) => ["leases", filter] as const,
  charges: (period?: string) => ["charges", period ?? ""] as const,
  payments: (chargeId: number) => ["charges", chargeId, "payments"] as const,
  vendors: ["vendors"] as const,
  workOrders: (filter: WorkOrderFilter = {}) => ["work-orders", filter] as const,
  dashboard: ["dashboard"] as const,
  settings: ["settings"] as const,
};

export type LeaseFilter = { tenant_id?: number; unit_id?: number; status?: string };
export type WorkOrderFilter = { status?: string; property_id?: number };

/**
 * Anything that can change a rent figure, an occupancy count, or a lease also
 * changes the dashboard and the property list, so mutations invalidate the
 * whole set rather than trying to be clever about it.
 */
export async function invalidateAll(qc: QueryClient): Promise<void> {
  await Promise.all([
    qc.invalidateQueries({ queryKey: keys.properties }),
    qc.invalidateQueries({ queryKey: ["units"] }),
    qc.invalidateQueries({ queryKey: ["tenants"] }),
    qc.invalidateQueries({ queryKey: ["leases"] }),
    qc.invalidateQueries({ queryKey: ["charges"] }),
    qc.invalidateQueries({ queryKey: ["work-orders"] }),
    qc.invalidateQueries({ queryKey: keys.vendors }),
    qc.invalidateQueries({ queryKey: keys.dashboard }),
  ]);
}

export function useInvalidateAll(): () => Promise<void> {
  const qc = useQueryClient();
  return () => invalidateAll(qc);
}

// ── Fetchers ───────────────────────────────────────────────────────
// The response types come from the server's route definitions, so a renamed
// column or a moved route fails to compile here rather than at runtime.

type PropertiesRes = InferResponseType<typeof rpc.api.properties.$get, 200>;
type PropertyRes = InferResponseType<(typeof rpc.api.properties)[":id"]["$get"], 200>;
type UnitsRes = InferResponseType<typeof rpc.api.units.$get, 200>;
type TenantsRes = InferResponseType<typeof rpc.api.tenants.$get, 200>;
type TenantRes = InferResponseType<(typeof rpc.api.tenants)[":id"]["$get"], 200>;
type LeasesRes = InferResponseType<typeof rpc.api.leases.$get, 200>;
type ChargesRes = InferResponseType<(typeof rpc.api)["rent-charges"]["$get"], 200>;
type PaymentsRes = InferResponseType<(typeof rpc.api)["rent-charges"][":id"]["payments"]["$get"], 200>;
type VendorsRes = InferResponseType<typeof rpc.api.vendors.$get, 200>;
type WorkOrdersRes = InferResponseType<(typeof rpc.api)["work-orders"]["$get"], 200>;
type SummaryRes = InferResponseType<typeof rpc.api.dashboard.summary.$get, 200>;
type SettingsRes = InferResponseType<typeof rpc.api.settings.$get, 200>;

export const fetchProperties = () =>
  unwrap<PropertiesRes>(rpc.api.properties.$get()).then((r) => r.properties as Property[]);

export const fetchProperty = (id: number) =>
  unwrap<PropertyRes>(rpc.api.properties[":id"].$get({ param: { id: String(id) } })).then((r) => r.property as Property);

export const fetchUnits = (propertyId?: number) =>
  unwrap<UnitsRes>(
    rpc.api.units.$get({ query: propertyId ? { property_id: String(propertyId) } : {} }),
  ).then((r) => r.units as Unit[]);

export const fetchTenants = (q?: string) =>
  unwrap<TenantsRes>(rpc.api.tenants.$get({ query: q ? { q } : {} })).then((r) => r.tenants as Tenant[]);

export const fetchTenant = (id: number) =>
  unwrap<TenantRes>(rpc.api.tenants[":id"].$get({ param: { id: String(id) } })).then((r) => r.tenant as Tenant);

export const fetchLeases = (filter: LeaseFilter = {}) => {
  const query: Record<string, string> = {};
  if (filter.tenant_id) query.tenant_id = String(filter.tenant_id);
  if (filter.unit_id) query.unit_id = String(filter.unit_id);
  if (filter.status) query.status = filter.status;
  return unwrap<LeasesRes>(rpc.api.leases.$get({ query })).then((r) => r.leases as Lease[]);
};

export const fetchCharges = (period?: string) =>
  unwrap<ChargesRes>(rpc.api["rent-charges"].$get({ query: period ? { period } : {} }))
    .then((r) => r.charges as RentCharge[]);

export const fetchPayments = (chargeId: number) =>
  unwrap<PaymentsRes>(rpc.api["rent-charges"][":id"].payments.$get({ param: { id: String(chargeId) } }))
    .then((r) => r.payments as Payment[]);

export const fetchVendors = () =>
  unwrap<VendorsRes>(rpc.api.vendors.$get()).then((r) => r.vendors as Vendor[]);

export const fetchWorkOrders = (filter: WorkOrderFilter = {}) => {
  const query: Record<string, string> = {};
  if (filter.status) query.status = filter.status;
  if (filter.property_id) query.property_id = String(filter.property_id);
  return unwrap<WorkOrdersRes>(rpc.api["work-orders"].$get({ query })).then((r) => r.work_orders as WorkOrder[]);
};

export const fetchDashboard = () =>
  unwrap<SummaryRes>(rpc.api.dashboard.summary.$get()) as Promise<DashboardSummary>;

export const fetchSettings = () =>
  unwrap<SettingsRes>(rpc.api.settings.$get()).then((r) => r.settings);

// ── Hooks ──────────────────────────────────────────────────────────

export const useProperties = () =>
  useQuery({ queryKey: keys.properties, queryFn: fetchProperties });

export const useProperty = (id: number) =>
  useQuery({ queryKey: keys.property(id), queryFn: () => fetchProperty(id), enabled: Number.isFinite(id) });

export const useUnits = (propertyId?: number) =>
  useQuery({ queryKey: keys.units(propertyId ? { property_id: propertyId } : {}), queryFn: () => fetchUnits(propertyId) });

export const useTenants = (q?: string) =>
  useQuery({ queryKey: keys.tenants(q), queryFn: () => fetchTenants(q) });

export const useTenant = (id: number) =>
  useQuery({ queryKey: keys.tenant(id), queryFn: () => fetchTenant(id), enabled: Number.isFinite(id) });

export const useLeases = (filter: LeaseFilter = {}) =>
  useQuery({ queryKey: keys.leases(filter), queryFn: () => fetchLeases(filter) });

export const useCharges = (period?: string) =>
  useQuery({ queryKey: keys.charges(period), queryFn: () => fetchCharges(period) });

export const usePayments = (chargeId: number | null) =>
  useQuery({
    queryKey: keys.payments(chargeId ?? 0),
    queryFn: () => fetchPayments(chargeId as number),
    enabled: chargeId !== null,
  });

export const useVendors = () =>
  useQuery({ queryKey: keys.vendors, queryFn: fetchVendors });

export const useWorkOrders = (filter: WorkOrderFilter = {}) =>
  useQuery({ queryKey: keys.workOrders(filter), queryFn: () => fetchWorkOrders(filter) });

export const useDashboard = () =>
  useQuery({ queryKey: keys.dashboard, queryFn: fetchDashboard });

export const useSettingsQuery = () =>
  useQuery({ queryKey: keys.settings, queryFn: fetchSettings });
