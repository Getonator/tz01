import {
  clampPointsToBounds,
  clonePoints,
  deepEqualPoints,
  polygonsOverlap,
  translatePoints,
} from './geometry.js';

export function clonePolygon(polygon) {
  return {
    ...polygon,
    points: clonePoints(polygon.points),
  };
}

export function cloneScene(state) {
  return {
    polygons: state.polygons.map(clonePolygon),
    selectedId: state.selectedId,
    nextId: state.nextId,
  };
}

export function getPolygonById(polygons, polygonId) {
  return polygons.find((polygon) => polygon.id === polygonId) || null;
}

export function getPolygonIndexById(polygons, polygonId) {
  return polygons.findIndex((polygon) => polygon.id === polygonId);
}

export function attemptPolygonMove({ polygonId, dx, dy, scene, width, height }) {
  const index = getPolygonIndexById(scene.polygons, polygonId);
  if (index === -1) {
    return null;
  }

  const originalPolygon = scene.polygons[index];
  const others = scene.polygons.filter((polygon) => polygon.id !== polygonId);

  const validate = (factor) => {
    const translated = translatePoints(originalPolygon.points, dx * factor, dy * factor);
    const clamped = clampPointsToBounds(translated, width, height);
    const overlaps = others.some((polygon) => polygonsOverlap(clamped, polygon.points));

    if (overlaps) {
      return null;
    }

    return clamped;
  };

  let bestPoints = validate(1);
  if (bestPoints) {
    return {
      points: bestPoints,
      changed: !deepEqualPoints(bestPoints, originalPolygon.points),
    };
  }

  let low = 0;
  let high = 1;
  bestPoints = originalPolygon.points;

  for (let iteration = 0; iteration < 20; iteration += 1) {
    const mid = (low + high) / 2;
    const candidate = validate(mid);
    if (candidate) {
      low = mid;
      bestPoints = candidate;
    } else {
      high = mid;
    }
  }

  return {
    points: clonePoints(bestPoints),
    changed: !deepEqualPoints(bestPoints, originalPolygon.points),
  };
}

export function serializeScene(state) {
  return JSON.stringify(
    {
      version: 1,
      selectedId: state.selectedId,
      nextId: state.nextId,
      polygons: state.polygons.map((polygon) => ({
        id: polygon.id,
        name: polygon.name,
        color: polygon.color,
        points: polygon.points,
      })),
    },
    null,
    2
  );
}

export function parseScene(text, width, height) {
  const parsed = JSON.parse(text);

  if (!parsed || !Array.isArray(parsed.polygons)) {
    throw new Error('Некорректный JSON сцены');
  }

  const polygons = parsed.polygons.map((polygon, index) => {
    if (!polygon.id || !polygon.name || !polygon.color || !Array.isArray(polygon.points)) {
      throw new Error(`Некорректный полигон в позиции ${index + 1}`);
    }

    const normalizedPoints = polygon.points.map((point) => ({
      x: Number(point.x),
      y: Number(point.y),
    }));

    return {
      id: polygon.id,
      name: polygon.name,
      color: polygon.color,
      points: clampPointsToBounds(normalizedPoints, width, height),
      createdAt: Date.now(),
      animationStart: 0,
    };
  });

  for (let i = 0; i < polygons.length; i += 1) {
    for (let j = i + 1; j < polygons.length; j += 1) {
      if (polygonsOverlap(polygons[i].points, polygons[j].points)) {
        throw new Error('Импорт невозможен: полигоны пересекаются или накладываются');
      }
    }
  }

  return {
    polygons,
    selectedId: parsed.selectedId || null,
    nextId:
      Number.isInteger(parsed.nextId) && parsed.nextId > 0
        ? parsed.nextId
        : polygons.length + 1,
  };
}
