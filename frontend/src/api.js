import axios from "axios";

export const api = axios.create({
  baseURL: "/api"
});

export function imageUrl(path) {
  return path;
}

export function adminHeaders() {
  const token = localStorage.getItem("adminToken");
  return token ? { "X-Admin-Token": token } : {};
}
