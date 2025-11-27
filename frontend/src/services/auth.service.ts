import axios from 'axios';
import { apiClient } from './api.client';

// Use /api as fallback to match NestJS global prefix (same as api.client.ts)
const API_URL = import.meta.env.VITE_API_URL || '/api';

export interface User {
  id: string;
  name: string;
  email: string;
  role: string;
}

export interface AuthResponse {
  accessToken: string;
  refreshToken: string;
  user: User;
}

export interface LoginCredentials {
  email: string;
  password: string;
}

export interface RegisterData {
  name: string;
  email: string;
  password: string;
  role?: string;
}

class AuthService {
  async login(credentials: LoginCredentials): Promise<AuthResponse> {
    const response = await axios.post<AuthResponse>(`${API_URL}/auth/login`, credentials);

    if (response.data.accessToken) {
      localStorage.setItem('accessToken', response.data.accessToken);
      localStorage.setItem('refreshToken', response.data.refreshToken);
      localStorage.setItem('user', JSON.stringify(response.data.user));
    }

    return response.data;
  }

  async register(data: RegisterData): Promise<AuthResponse> {
    const response = await axios.post<AuthResponse>(`${API_URL}/auth/register`, data);

    if (response.data.accessToken) {
      localStorage.setItem('accessToken', response.data.accessToken);
      localStorage.setItem('refreshToken', response.data.refreshToken);
      localStorage.setItem('user', JSON.stringify(response.data.user));
    }

    return response.data;
  }

  async logout(): Promise<void> {
    try {
      // Use apiClient which already includes the auth token
      await apiClient.post('/auth/logout');
    } catch (error) {
      console.error('Logout error:', error);
      // Continue with logout even if API call fails
    }

    localStorage.removeItem('accessToken');
    localStorage.removeItem('refreshToken');
    localStorage.removeItem('user');
  }

  async refreshToken(): Promise<string | null> {
    const refreshToken = localStorage.getItem('refreshToken');

    if (!refreshToken) {
      return null;
    }

    try {
      const response = await axios.post<{ accessToken: string; refreshToken: string }>(
        `${API_URL}/auth/refresh`,
        { refreshToken }
      );

      localStorage.setItem('accessToken', response.data.accessToken);
      localStorage.setItem('refreshToken', response.data.refreshToken);

      return response.data.accessToken;
    } catch (error) {
      this.logout();
      return null;
    }
  }

  getCurrentUser(): User | null {
    const userStr = localStorage.getItem('user');
    if (userStr) {
      return JSON.parse(userStr);
    }
    return null;
  }

  getAccessToken(): string | null {
    return localStorage.getItem('accessToken');
  }

  getRefreshToken(): string | null {
    return localStorage.getItem('refreshToken');
  }
}

export default new AuthService();
