const AUTH_RETURN_KEY = "lexus-auth-return";

export const startLogin = () => {
  if (typeof window === "undefined") return;
  const current = `${window.location.pathname}${window.location.search}${window.location.hash}`;
  if (current && current !== "/entrar") {
    try {
      sessionStorage.setItem(AUTH_RETURN_KEY, current);
    } catch {}
  }
  window.location.href = "/entrar";
};

export const consumeLoginReturnPath = () => {
  if (typeof window === "undefined") return "/";
  try {
    const value = sessionStorage.getItem(AUTH_RETURN_KEY);
    sessionStorage.removeItem(AUTH_RETURN_KEY);
    if (value && value.startsWith("/") && !value.startsWith("//") && value !== "/entrar") {
      return value;
    }
  } catch {}
  return "/";
};
