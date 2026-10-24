import { useState, useEffect } from 'react';
import { DesktopDashboard } from '../../components/dashboard/DesktopDashboard';
import { MobileDashboard } from '../../components/dashboard/MobileDashboard';

export default function DashboardPage() {
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Apply dark background wrapper for both mobile and desktop layouts
  return isMobile ? <MobileDashboard /> : <DesktopDashboard />;
}
