import axios from "axios";

const API = axios.create({
  // Point directly to the new Cloudflare Hono interview sessions route
  baseURL: import.meta.env.VITE_API_BASE_URL || "http://localhost:8787/api/v1/interview-sessions",
});

export default API;