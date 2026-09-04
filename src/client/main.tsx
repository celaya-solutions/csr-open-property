import { createRoot } from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { RouterProvider } from "@tanstack/react-router";
import { router } from "./router";
import { installCourseAuth } from "./course-auth";
import "./styles.css";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Screens share a cache, so moving between them is instant and the data
      // refreshes quietly in the background.
      staleTime: 30_000,
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
});

installCourseAuth();
createRoot(document.getElementById("app")!).render(
  <QueryClientProvider client={queryClient}>
    <RouterProvider router={router} />
  </QueryClientProvider>,
);
