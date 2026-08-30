export const siteConfig = {
  name: "MMG Stellar",
  description: "Sports facility booking platform for MMG Stellar"
} as const;

const environmentLabels: Record<string, string> = {
  local: "LOCAL",
  development: "DEV",
  dev: "DEV",
  qa: "QA",
  stage: "STAGE",
  staging: "STAGE",
  preview: "PREVIEW",
  prod: "PROD",
  production: "PROD"
};

type SiteEnvironment = Pick<NodeJS.ProcessEnv, "APP_ENV" | "VERCEL_ENV" | "NODE_ENV">;

export function getSiteTitle(env: Partial<SiteEnvironment> = process.env) {
  const configuredEnvironment = env.APP_ENV?.trim().toLowerCase();
  const fallbackEnvironment = env.VERCEL_ENV === "production"
    ? "prod"
    : env.VERCEL_ENV === "preview"
      ? "preview"
      : env.NODE_ENV === "development"
        ? "local"
        : undefined;
  const environment = configuredEnvironment || fallbackEnvironment;

  if (!environment || environment === "prod" || environment === "production") {
    return siteConfig.name;
  }

  return `${siteConfig.name} - ${environmentLabels[environment] ?? environment.toUpperCase()}`;
}
