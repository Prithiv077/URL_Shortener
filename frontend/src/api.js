import axios from "axios";

// Change baseURL to your EC2 public IP when deploying to AWS
// e.g. "http://13.233.xx.xx:5000/api"
const API = axios.create({
  baseURL: "https://107.21.170.243:5000/api",
});

// Interceptor: automatically adds JWT token to EVERY request
// So you don't have to manually add it in Login.js, Dashboard.js, etc.
API.interceptors.request.use((config) => {
  const token = localStorage.getItem("token");
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

export default API;