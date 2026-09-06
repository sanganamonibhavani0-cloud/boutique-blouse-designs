import axios from "axios";

export const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || "/api"
});

export function imageUrl(path) {
  if (!path) return "";

  if (path.startsWith("http://") || path.startsWith("https://")) {
    return path;
  }

  const baseUrl = import.meta.env.VITE_API_URL || "";
  return `${baseUrl}${path}`;
}

export function adminHeaders() {
  const token = localStorage.getItem("adminToken");
  return token ? { "X-Admin-Token": token } : {};
}