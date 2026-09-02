import {
  defineRailway,
  github,
  project,
  service,
  volume,
} from "railway/iac";

export default defineRailway(() => {
  const api = service("api", {
    source: github("celaya-solutions/csr-open-property", { branch: "main" }),
    build: "pnpm install --frozen-lockfile && pnpm typecheck && pnpm build",
    start: "pnpm start",
    healthcheck: "/api/health",
    healthcheckTimeout: 120,
    env: {
      DB_PATH: "/app/data/app.db",
      UPLOAD_PATH: "/app/data/uploads",
      NODE_ENV: "production",
      RAILPACK_NODE_VERSION: "22",
    },
    volumeMounts: {
      "/app/data": volume("course-data", { sizeMB: 1024 }),
    },
  });

  return project("capstone-staging-open-property", {
    resources: [api],
  });
});
