import { HomePage } from "./pages/HomePage";
import { PrivacyPage } from "./pages/PrivacyPage";

export function App() {
  const path = window.location.pathname.replace(/\/+$/, "") || "/";
  if (path === "/privacidade") return <PrivacyPage />;
  return <HomePage />;
}
