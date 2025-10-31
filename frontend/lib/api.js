import axios from "axios";

const api = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000",
});

api.interceptors.request.use((config) => {
  if (typeof window !== "undefined") {
    const token = localStorage.getItem("access_token");
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
  }
  return config;
});

export const setAuthToken = (token) => {
  if (typeof window !== "undefined") {
    if (token) {
      localStorage.setItem("access_token", token);
    } else {
      localStorage.removeItem("access_token");
    }
  }
};

export default api;
