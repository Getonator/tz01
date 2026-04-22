import {
  centroid,
  clampPointsToBounds,
  clonePoints,
  polygonsOverlap,
  translatePoints,
} from './geometry.js';

function randomBetween(min, max) {
  return min + Math.random() * (max - min);
}

function randomInt(min, max) {
  return Math.floor(randomBetween(min, max + 1));
}

function randomColor() {
  const palette = ['#E76F51', '#2A9D8F', '#264653', '#8AB17D', '#E9C46A', '#F4A261', '#6D597A'];
  return palette[randomInt(0, palette.length - 1)];
}

function generateShapePoints(vertexCount) {
  const angleStep = (Math.PI * 2) / vertexCount;
  const points = [];

  for (let index = 0; index < vertexCount; index += 1) {
    const angle = index * angleStep + randomBetween(-0.42, 0.42);
    const radius = randomBetween(26, 70);
    points.push({
      x: Math.cos(angle) * radius,
      y: Math.sin(angle) * radius,
      angle,
      radius,
    });
  }

  points.sort((pointA, pointB) => pointA.angle - pointB.angle);

  const center = centroid(points);
  return points.map((point) => ({
    x: point.x - center.x,
    y: point.y - center.y,
  }));
}

function placeShape(points, width, height) {
  const margin = 20;
  const placed = translatePoints(
    points,
    randomBetween(margin, Math.max(margin, width - margin)),
    randomBetween(margin, Math.max(margin, height - margin))
  );
  return clampPointsToBounds(placed, width, height);
}

export function createRandomPolygon({ width, height, existingPolygons, nextId }) {
  const attempts = 350;

  for (let attempt = 0; attempt < attempts; attempt += 1) {
    const vertexCount = randomInt(3, 7);
    const basePoints = generateShapePoints(vertexCount);
    const points = placeShape(basePoints, width, height);

    const intersects = existingPolygons.some((polygon) => polygonsOverlap(points, polygon.points));
    if (intersects) {
      continue;
    }

    return {
      id: `polygon-${nextId}`,
      name: `Полигон ${nextId}`,
      color: randomColor(),
      points: clonePoints(points),
      createdAt: Date.now(),
      animationStart: performance.now(),
    };
  }

  return null;
}
