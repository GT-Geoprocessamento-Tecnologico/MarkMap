import { BackToTop } from "./components/BackToTop";
import { InstallAppNotice } from "./components/InstallAppNotice";
import { DownloadPage } from "./pages/DownloadPage";
import { HomePage } from "./pages/HomePage";
import { OfflinePage } from "./pages/OfflinePage";
import { PrivacyPage } from "./pages/PrivacyPage";
import { ProductPage } from "./pages/ProductPage";

export function App() {
  const path = window.location.pathname.replace(/\/+$/, "") || "/";

  let page = <HomePage />;
  if (path === "/produto") page = <ProductPage />;
  else if (path === "/offline") page = <OfflinePage />;
  else if (path === "/baixar") page = <DownloadPage />;
  else if (path === "/privacidade") page = <PrivacyPage />;

  return (
    <>
      {page}
      <InstallAppNotice />
      <BackToTop />
    </>
  );
}
