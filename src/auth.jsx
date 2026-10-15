import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { api, getToken, setToken, setUnauthorizedHandler } from "./api";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [status, setStatus] = useState(getToken() ? "checking" : "signed-out");
  const [error, setError] = useState("");

  const signOut = useCallback(async () => {
    await api("/auth/logout", { method: "POST" }).catch(() => {});
    setToken(null);
    setUser(null);
    setStatus("signed-out");
  }, []);

  const restore = useCallback(async () => {
    if (!getToken()) return setStatus("signed-out");
    setStatus("checking");
    setError("");
    try {
      const { user: current } = await api("/auth/me");
      setUser(current);
      setStatus("signed-in");
    } catch (requestError) {
      if (requestError.status === 401) {
        setToken(null);
        setStatus("signed-out");
      } else {
        setError(requestError.message);
        setStatus("offline");
      }
    }
  }, []);

  useEffect(() => {
    setUnauthorizedHandler(() => {
      setToken(null);
      setUser(null);
      setStatus("signed-out");
      setError("Votre session a expiré. Reconnectez-vous.");
    });
    restore();
  }, [restore]);

  const authenticate = useCallback(async (mode, form) => {
    const data = await api(`/auth/${mode}`, { body: form });
    setToken(data.token);
    setUser(data.user);
    setError("");
    setStatus("signed-in");
  }, []);

  const value = useMemo(() => ({ user, setUser, status, error, authenticate, signOut, restore }), [user, status, error, authenticate, signOut, restore]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  return useContext(AuthContext);
}
