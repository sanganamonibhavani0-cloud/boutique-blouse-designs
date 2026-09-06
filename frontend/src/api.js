import axios from "axios";

const API_ORIGIN = import.meta.env.VITE_API_URL || "";

export const api = axios.create({
  baseURL: API_ORIGIN ? `${API_ORIGIN}/api` : "/api",
});

export function imageUrl(path) {
  if (!path) return "";

  if (path.startsWith("http://") || path.startsWith("https://")) {
    return path;
  }

  return API_ORIGIN ? `${API_ORIGIN}${path}` : path;
}

export function adminHeaders() {
  const token = localStorage.getItem("adminToken");

  return token
    ? { "X-Admin-Token": token }
    : {};
}