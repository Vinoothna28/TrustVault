import React, { createContext, useContext, useState, useEffect } from 'react';
import { apiRequest } from '../api/client';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(() => {
    try {
      const stored = localStorage.getItem('trustvault_user');
      return stored ? JSON.parse(stored) : null;
    } catch {
      return null;
    }
  });
  const [token, setToken] = useState(() => localStorage.getItem('trustvault_token') || null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Verify session on initial load
    const verifySession = async () => {
      if (token) {
        try {
          const res = await apiRequest('/auth/me');
          if (res.success && res.user) {
            setUser(res.user);
            localStorage.setItem('trustvault_user', JSON.stringify(res.user));
          }
        } catch {
          logout();
        }
      }
      setLoading(false);
    };

    verifySession();
  }, [token]);

  const login = async (email, password) => {
    const res = await apiRequest('/auth/login', {
      method: 'POST',
      body: { email, password }
    });

    if (res.success && res.token) {
      setToken(res.token);
      setUser(res.user);
      localStorage.setItem('trustvault_token', res.token);
      localStorage.setItem('trustvault_user', JSON.stringify(res.user));
    }
    return res;
  };

  const register = async (userData) => {
    const res = await apiRequest('/auth/register', {
      method: 'POST',
      body: userData
    });

    if (res.success && res.token) {
      setToken(res.token);
      setUser(res.user);
      localStorage.setItem('trustvault_token', res.token);
      localStorage.setItem('trustvault_user', JSON.stringify(res.user));
    }
    return res;
  };

  const logout = () => {
    setToken(null);
    setUser(null);
    localStorage.removeItem('trustvault_token');
    localStorage.removeItem('trustvault_user');
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        loading,
        isAuthenticated: !!token && !!user,
        role: user?.role || 'viewer',
        login,
        register,
        logout
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
