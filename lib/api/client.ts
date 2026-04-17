import axios from "axios";
import { env } from "@/lib/env";

/**
 * Shared Axios instance for app/api routes and client-side fetch helpers.
 * Point NEXT_PUBLIC_API_BASE_URL at an external API when splitting the backend.
 */
export const apiClient = axios.create({
  baseURL: env.publicApiBaseUrl || undefined,
  headers: { "Content-Type": "application/json" },
  timeout: 30_000,
});
