import axios from "axios";

const API_BASE_URL = import.meta.env.DEV
  ? "/api"
  : "https://boutique-blouse-designs-api.onrender.com";

export const api = axios.create({
  baseURL: API_BASE_URL
});

export function imageUrl(path) {
  if (!path) return "";

  if (path.startsWith("http://") || path.startsWith("https://")) {
    return path;
  }

  return `${API_BASE_URL}${path}`;
}

export function adminHeaders() {
  const token = localStorage.getItem("adminToken");
  return token ? { "X-Admin-Token": token } : {};
}