export type Coordinate = [number, number];

export type GeometryType = 'Point' | 'LineString' | 'Polygon';

export interface DrawingSession {
  type: GeometryType;
  vertices: Coordinate[];
  undoStack: Coordinate[][];
  redoStack: Coordinate[][];
  isFinished: boolean;
}

export interface PointGeometry {
  type: 'Point';
  coordinates: Coordinate;
}

export interface LineStringGeometry {
  type: 'LineString';
  coordinates: Coordinate[];
}

export interface PolygonGeometry {
  type: 'Polygon';
  coordinates: Coordinate[][];
}

export type Geometry = PointGeometry | LineStringGeometry | PolygonGeometry;

/**
 * Cria uma nova sessão de desenho para o tipo de geometria especificado.
 */
export function createDrawingSession(type: GeometryType): DrawingSession {
  return {
    type,
    vertices: [],
    undoStack: [],
    redoStack: [],
    isFinished: false,
  };
}

/**
 * Adiciona um novo vértice à sessão de desenho atual.
 * A função é pura e retorna uma nova instância do estado (imutável).
 */
export function addDrawingVertex(session: DrawingSession, vertex: Coordinate): DrawingSession {
  if (session.isFinished) {
    return session;
  }

  // Para um Ponto, só podemos ter um vértice. Se já existir, substituímos.
  if (session.type === 'Point' && session.vertices.length >= 1) {
    return {
      ...session,
      undoStack: [...session.undoStack, session.vertices],
      redoStack: [], // Limpa o redo stack ao fazer uma nova ação
      vertices: [vertex],
    };
  }

  return {
    ...session,
    undoStack: [...session.undoStack, session.vertices],
    redoStack: [], // Limpa o redo stack ao fazer uma nova ação
    vertices: [...session.vertices, vertex],
  };
}

/**
 * Desfaz a última adição de vértice (Undo).
 */
export function undoDrawingVertex(session: DrawingSession): DrawingSession {
  if (session.isFinished || session.undoStack.length === 0) {
    return session; // Nada para desfazer
  }

  const previousVertices = session.undoStack[session.undoStack.length - 1];
  if (!previousVertices) return session;

  const newUndoStack = session.undoStack.slice(0, -1);

  return {
    ...session,
    undoStack: newUndoStack,
    redoStack: [...session.redoStack, session.vertices],
    vertices: previousVertices,
  };
}

/**
 * Refaz a última ação desfeita (Redo).
 */
export function redoDrawingVertex(session: DrawingSession): DrawingSession {
  if (session.isFinished || session.redoStack.length === 0) {
    return session; // Nada para refazer
  }

  const nextVertices = session.redoStack[session.redoStack.length - 1];
  if (!nextVertices) return session;

  const newRedoStack = session.redoStack.slice(0, -1);

  return {
    ...session,
    undoStack: [...session.undoStack, session.vertices],
    redoStack: newRedoStack,
    vertices: nextVertices,
  };
}

/**
 * Finaliza a sessão de desenho e retorna a geometria gerada validada.
 * Lança um erro se a geometria não for válida (ex: pontos insuficientes).
 */
export function finishDrawingSession(session: DrawingSession): Geometry {
  const { type, vertices } = session;

  if (type === 'Point') {
    const point = vertices[vertices.length - 1];
    if (!point || vertices.length < 1) {
      throw new Error('Geometria inválida: Point requer pelo menos 1 vértice.');
    }
    return {
      type: 'Point',
      coordinates: point,
    };
  }

  if (type === 'LineString') {
    if (vertices.length < 2) {
      throw new Error('Geometria inválida: LineString requer pelo menos 2 vértices.');
    }
    return {
      type: 'LineString',
      coordinates: [...vertices],
    };
  }

  if (type === 'Polygon') {
    if (vertices.length < 3) {
      throw new Error('Geometria inválida: Polygon requer pelo menos 3 vértices.');
    }
    
    const coordinates = [...vertices];
    const firstVertex = coordinates[0];
    const lastVertex = coordinates[coordinates.length - 1];

    if (!firstVertex || !lastVertex) {
      throw new Error('Geometria inválida: Polygon requer pelo menos 3 vértices.');
    }
    
    // Garante que o polígono está fechado (o primeiro e o último ponto devem ser iguais)
    if (firstVertex[0] !== lastVertex[0] || firstVertex[1] !== lastVertex[1]) {
      coordinates.push([firstVertex[0], firstVertex[1]]);
    }

    return {
      type: 'Polygon',
      coordinates: [coordinates], // Polígonos usam matrizes aninhadas (array de anéis)
    };
  }

  throw new Error(`Tipo de geometria não suportado: ${type}`);
}
