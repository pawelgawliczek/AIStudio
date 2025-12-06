import axios, { AxiosInstance, AxiosError, InternalAxiosRequestConfig } from 'axios';

// Use /api as fallback to match NestJS global prefix
const API_BASE_URL = import.meta.env.VITE_API_URL || '/api';

// Event system for session expiration notifications
type SessionExpiredCallback = (redirectPath?: string) => void;
const sessionExpiredCallbacks: Set<SessionExpiredCallback> = new Set();

export const onSessionExpired = (callback: SessionExpiredCallback) => {
  sessionExpiredCallbacks.add(callback);
  return () => sessionExpiredCallbacks.delete(callback);
};

const notifySessionExpired = (redirectPath?: string) => {
  sessionExpiredCallbacks.forEach(callback => callback(redirectPath));
};

class ApiClient {
  private client: AxiosInstance;
  private isRefreshing = false;
  private refreshQueue: Array<{
    resolve: (token: string) => void;
    reject: (error: any) => void;
  }> = [];

  constructor() {
    this.client = axios.create({
      baseURL: API_BASE_URL,
      headers: {
        'Content-Type': 'application/json',
      },
    });

    this.setupInterceptors();
  }

  private setupInterceptors() {
    // Request interceptor: Add auth token to requests
    this.client.interceptors.request.use(
      (config) => {
        const token = localStorage.getItem('accessToken');
        // ST-182 DEBUG: Log auth header status
        console.log('[API] Request:', config.method?.toUpperCase(), config.url);
        console.log('[API] Token present:', !!token);
        if (token) {
          config.headers.Authorization = `Bearer ${token}`;
          console.log('[API] Added Authorization header');
        } else {
          console.warn('[API] No token in localStorage!');
        }
        return config;
      },
      (error) => {
        return Promise.reject(error);
      }
    );

    // Response interceptor: Handle token refresh and session expiration
    this.client.interceptors.response.use(
      (response) => response,
      async (error: AxiosError) => {
        const originalRequest = error.config as InternalAxiosRequestConfig & { _retry?: boolean };

        // Handle 401 Unauthorized
        if (error.response?.status === 401 && !originalRequest._retry) {
          // Mark request as retried to prevent infinite loops
          originalRequest._retry = true;

          // If we're already refreshing, queue this request
          if (this.isRefreshing) {
            return new Promise((resolve, reject) => {
              this.refreshQueue.push({ resolve, reject });
            })
              .then((token) => {
                if (originalRequest.headers) {
                  originalRequest.headers.Authorization = `Bearer ${token}`;
                }
                return this.client(originalRequest);
              })
              .catch((err) => {
                return Promise.reject(err);
              });
          }

          // Start refresh process
          this.isRefreshing = true;

          try {
            const newToken = await this.refreshAccessToken();

            if (newToken) {
              // Update authorization header for original request
              if (originalRequest.headers) {
                originalRequest.headers.Authorization = `Bearer ${newToken}`;
              }

              // Process queued requests
              this.refreshQueue.forEach(({ resolve }) => resolve(newToken));
              this.refreshQueue = [];

              // Retry original request
              return this.client(originalRequest);
            } else {
              throw new Error('Failed to refresh token');
            }
          } catch (refreshError) {
            // Refresh failed - clear queue and notify session expired
            this.refreshQueue.forEach(({ reject }) => reject(refreshError));
            this.refreshQueue = [];

            // Clear auth state
            this.clearAuthState();

            // Notify listeners about session expiration
            const currentPath = window.location.pathname + window.location.search;
            notifySessionExpired(currentPath);

            return Promise.reject(refreshError);
          } finally {
            this.isRefreshing = false;
          }
        }

        return Promise.reject(error);
      }
    );
  }

  private async refreshAccessToken(): Promise<string | null> {
    const refreshToken = localStorage.getItem('refreshToken');

    if (!refreshToken) {
      return null;
    }

    try {
      const response = await axios.post<{ accessToken: string; refreshToken: string }>(
        `${API_BASE_URL}/auth/refresh`,
        { refreshToken }
      );

      const { accessToken, refreshToken: newRefreshToken } = response.data;

      // Update tokens in localStorage
      localStorage.setItem('accessToken', accessToken);
      localStorage.setItem('refreshToken', newRefreshToken);

      // Broadcast token update to other tabs
      this.broadcastTokenUpdate(accessToken, newRefreshToken);

      return accessToken;
    } catch (error) {
      console.error('Token refresh failed:', error);
      return null;
    }
  }

  private clearAuthState() {
    localStorage.removeItem('accessToken');
    localStorage.removeItem('refreshToken');
    localStorage.removeItem('user');

    // Broadcast logout to other tabs
    this.broadcastLogout();
  }

  private broadcastTokenUpdate(accessToken: string, refreshToken: string) {
    // Use BroadcastChannel for cross-tab communication
    try {
      const channel = new BroadcastChannel('auth_channel');
      channel.postMessage({
        type: 'TOKEN_UPDATED',
        accessToken,
        refreshToken,
      });
      channel.close();
    } catch (error) {
      // BroadcastChannel not supported, fallback to storage event
      localStorage.setItem('auth_event', JSON.stringify({
        type: 'TOKEN_UPDATED',
        timestamp: Date.now(),
      }));
    }
  }

  private broadcastLogout() {
    try {
      const channel = new BroadcastChannel('auth_channel');
      channel.postMessage({ type: 'LOGOUT' });
      channel.close();
    } catch (error) {
      localStorage.setItem('auth_event', JSON.stringify({
        type: 'LOGOUT',
        timestamp: Date.now(),
      }));
    }
  }

  getClient(): AxiosInstance {
    return this.client;
  }
}

export const apiClient = new ApiClient().getClient();
