import { useEffect, useState } from "react";

export type Language = "en" | "hi";

export function useLanguage(): Language {
  const [language, setLanguage] = useState<Language>(() =>
    localStorage.getItem("steady-language") === "hi" ? "hi" : "en"
  );

  useEffect(() => {
    const updateLanguage = () => {
      setLanguage(
        localStorage.getItem("steady-language") === "hi" ? "hi" : "en"
      );
    };

    window.addEventListener("steady-language-change", updateLanguage);
    window.addEventListener("storage", updateLanguage);

    return () => {
      window.removeEventListener("steady-language-change", updateLanguage);
      window.removeEventListener("storage", updateLanguage);
    };
  }, []);

  return language;
}