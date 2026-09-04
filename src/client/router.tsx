import {
  Outlet,
  createRootRoute,
  createRoute,
  createRouter,
  lazyRouteComponent,
} from "@tanstack/react-router";
import { AppContext } from "./context";
import { useAppState } from "./hooks/use-app-state";
import { Sidebar } from "./components/sidebar";
import { ErrorBanner } from "./components/error-banner";

function Layout() {
  const state = useAppState();
  return (
    <AppContext.Provider value={state}>
      <div className="flex h-screen min-h-0 overflow-hidden">
        <Sidebar />
        <main className="flex flex-1 flex-col overflow-hidden">
          {state.loading ? <Loading /> : <Outlet />}
        </main>
        <ErrorBanner />
      </div>
    </AppContext.Provider>
  );
}

function Loading() {
  return (
    <div className="flex flex-1 items-center justify-center text-muted-foreground">Loading…</div>
  );
}

function NotFound() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-2 p-12 text-center">
      <h1 className="text-xl font-semibold tracking-tight">Not found</h1>
      <p className="text-sm text-muted-foreground">That page doesn't exist.</p>
    </div>
  );
}

const rootRoute = createRootRoute({ component: Layout, notFoundComponent: NotFound });

// Every page is its own chunk: the browser downloads the dashboard first and
// fetches the rest as they are opened.
const page = (load: () => Promise<any>, name: string) => lazyRouteComponent(load, name);

const dashboard = () => page(() => import("./components/dashboard/dashboard-page"), "DashboardPage");

const routes = [
  createRoute({ getParentRoute: () => rootRoute, path: "/", component: dashboard() }),
  createRoute({ getParentRoute: () => rootRoute, path: "/dashboard", component: dashboard() }),
  createRoute({
    getParentRoute: () => rootRoute,
    path: "/properties",
    component: page(() => import("./components/properties/properties-list"), "PropertiesList"),
  }),
  createRoute({
    getParentRoute: () => rootRoute,
    path: "/properties/$id",
    component: page(() => import("./components/properties/property-page"), "PropertyPage"),
  }),
  createRoute({
    getParentRoute: () => rootRoute,
    path: "/tenants",
    component: page(() => import("./components/tenants/tenants-list"), "TenantsList"),
  }),
  createRoute({
    getParentRoute: () => rootRoute,
    path: "/tenants/$id",
    component: page(() => import("./components/tenants/tenant-page"), "TenantPage"),
  }),
  createRoute({
    getParentRoute: () => rootRoute,
    path: "/leases",
    component: page(() => import("./components/leases/leases-page"), "LeasesPage"),
  }),
  createRoute({
    getParentRoute: () => rootRoute,
    path: "/rent",
    component: page(() => import("./components/rent/rent-page"), "RentPage"),
  }),
  createRoute({
    getParentRoute: () => rootRoute,
    path: "/maintenance",
    component: page(() => import("./components/maintenance/maintenance-page"), "MaintenancePage"),
  }),
  createRoute({
    getParentRoute: () => rootRoute,
    path: "/settings",
    component: page(() => import("./components/settings/settings-page"), "SettingsPage"),
  }),
];

export const router = createRouter({
  routeTree: rootRoute.addChildren(routes),
  defaultPendingComponent: Loading,
});

declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router;
  }
}
