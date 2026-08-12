(() => {
  try {
    const saved = localStorage.getItem("momo-theme");
    const cookieDark = document.cookie.split("; ").includes("momo-theme=dark");
    if (saved === "dark" || (!saved && cookieDark)) {
      document.documentElement.dataset.theme = "dark";
    }
  } catch {
    // Storage may be unavailable in a restricted browser mode; light theme is safe.
  }
})();
