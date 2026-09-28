import React from 'react';

const Dashboard: React.FC = () => {
  return (
    <div className="dashboard">
      <h1>Dashboard</h1>
      <p>Entrada operacional do GeoNexo</p>
      {/* Placeholder for recent projects, total projects, total layers, recent imports, and CTA */}
      <div className="dashboard-content">
        <section>
          <h2>Projetos Recentes</h2>
          <p>Lista de projetos recentes</p>
        </section>
        <section>
          <h2>Total de Projetos</h2>
          <p>0</p>
        </section>
        <section>
          <h2>Total de Camadas</h2>
          <p>0</p>
        </section>
        <section>
          <h2>Importações Recentes</h2>
          <p>Lista de importações recentes</p>
        </section>
        <button className="cta-button">Novo Projeto</button>
      </div>
    </div>
  );
};

export default Dashboard;