import React from 'react';

const MapWorkspace: React.FC = () => {
  return (
    <div className="map-workspace" style={{ height: '100vh', width: '100vw', position: 'relative' }}>
      <div className="map-placeholder" style={{
        height: '100%',
        width: '100%',
        backgroundColor: 'var(--gn-color-background)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: '2rem',
        color: 'var(--gn-color-text-secondary)'
      }}>
        MapLibre / Terra Draw Placeholder
      </div>
      <div className="map-overlay" style={{
        position: 'absolute',
        top: '20px',
        left: '20px',
        backgroundColor: 'var(--gn-color-surface)',
        padding: '1rem',
        borderRadius: 'var(--gn-color-radius-md)',
        boxShadow: 'var(--gn-shadow-elevated)',
        color: 'var(--gn-color-text-primary)',
        zIndex: 10
      }}>
        <h3>Workspace Cartográfico</h3>
        <p>Painéis contextuais e legendas</p>
      </div>
    </div>
  );
};

export default MapWorkspace;