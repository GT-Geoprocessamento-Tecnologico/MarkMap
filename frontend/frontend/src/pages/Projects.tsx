import React from 'react';

const Projects: React.FC = () => {
  return (
    <div className="projects">
      <h1>Projetos</h1>
      <p>Gerenciamento de projetos</p>
      {/* Placeholder for table/list, search, status, last update, open workspace, create project */}
      <div className="projects-content">
        <section>
          <h2>Lista de Projetos</h2>
          <p>Tabela ou lista de projetos</p>
        </section>
        <section>
          <h2>Busca</h2>
          <p>Campo de busca local/server conforme volume</p>
        </section>
        <section>
          <h2>Status e Última Atualização</h2>
          <p>Informações de status e data de última atualização</p>
        </section>
        <button className="open-workspace-button">Abrir Workspace</button>
        <button className="create-project-button">Criar Projeto</button>
      </div>
    </div>
  );
};

export default Projects;