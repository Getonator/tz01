const EPSILON = 1e-9;

export function clonePoint(point) {
  return { x: point.x, y: point.y };
}

export function clonePoints(points) {
  return points.map(clonePoint);
}

export function getBoundingBox(points) {
  const xs = points.map((point) => point.x);
  const ys = points.map((point) => point.y);

  return {
    minX: Math.min(...xs),
    maxX: Math.max(...xs),
    minY: Math.min(...ys),
    maxY: Math.max(...ys),
  };
}

export function centroid(points) {
  const total = points.reduce(
    (accumulator, point) => {
      accumulator.x += point.x;
      accumulator.y += point.y;
      return accumulator;
    },
    { x: 0, y: 0 }
  );

  return {
    x: total.x / points.length,
    y: total.y / points.length,
  };
}

export function translatePoints(points, dx, dy) {
  return points.map((point) => ({ x: point.x + dx, y: point.y + dy }));
}

export function clampPointsToBounds(points, width, height) {
  const box = getBoundingBox(points);
  let dx = 0;
  let dy = 0;

  if (box.minX < 0) {
    dx = -box.minX;
  } else if (box.maxX > width) {
    dx = width - box.maxX;
  }

  if (box.minY < 0) {
    dy = -box.minY;
  } else if (box.maxY > height) {
    dy = height - box.maxY;
  }

  return translatePoints(points, dx, dy);
}

export function distance(pointA, pointB) {
  return Math.hypot(pointA.x - pointB.x, pointA.y - pointB.y);
}

function cross(pointA, pointB, pointC) {
  return (pointB.x - pointA.x) * (pointC.y - pointA.y) - (pointB.y - pointA.y) * (pointC.x - pointA.x);
}

function onSegment(pointA, pointB, pointC) {
  return (
    Math.min(pointA.x, pointB.x) - EPSILON <= pointC.x &&
    pointC.x <= Math.max(pointA.x, pointB.x) + EPSILON &&
    Math.min(pointA.y, pointB.y) - EPSILON <= pointC.y &&
    pointC.y <= Math.max(pointA.y, pointB.y) + EPSILON
  );
}

export function segmentsIntersect(segmentAStart, segmentAEnd, segmentBStart, segmentBEnd) {
  const d1 = cross(segmentAStart, segmentAEnd, segmentBStart);
  const d2 = cross(segmentAStart, segmentAEnd, segmentBEnd);
  const d3 = cross(segmentBStart, segmentBEnd, segmentAStart);
  const d4 = cross(segmentBStart, segmentBEnd, segmentAEnd);

  if (
    ((d1 > EPSILON && d2 < -EPSILON) || (d1 < -EPSILON && d2 > EPSILON)) &&
    ((d3 > EPSILON && d4 < -EPSILON) || (d3 < -EPSILON && d4 > EPSILON))
  ) {
    return true;
  }

  if (Math.abs(d1) <= EPSILON && onSegment(segmentAStart, segmentAEnd, segmentBStart)) return true;
  if (Math.abs(d2) <= EPSILON && onSegment(segmentAStart, segmentAEnd, segmentBEnd)) return true;
  if (Math.abs(d3) <= EPSILON && onSegment(segmentBStart, segmentBEnd, segmentAStart)) return true;
  if (Math.abs(d4) <= EPSILON && onSegment(segmentBStart, segmentBEnd, segmentAEnd)) return true;

  return false;
}

export function pointInPolygon(point, polygonPoints) {
  let inside = false;

  for (let index = 0, previous = polygonPoints.length - 1; index < polygonPoints.length; previous = index, index += 1) {
    const currentPoint = polygonPoints[index];
    const previousPoint = polygonPoints[previous];

    const intersects =
      currentPoint.y > point.y !== previousPoint.y > point.y &&
      point.x <
        ((previousPoint.x - currentPoint.x) * (point.y - currentPoint.y)) /
          (previousPoint.y - currentPoint.y + EPSILON) +
          currentPoint.x;

    if (intersects) {
      inside = !inside;
    }
  }

  return inside;
}

export function polygonsOverlap(pointsA, pointsB) {
  const boxA = getBoundingBox(pointsA);
  const boxB = getBoundingBox(pointsB);

  const separated =
    boxA.maxX < boxB.minX ||
    boxB.maxX < boxA.minX ||
    boxA.maxY < boxB.minY ||
    boxB.maxY < boxA.minY;

  if (separated) {
    return false;
  }

  for (let indexA = 0; indexA < pointsA.length; indexA += 1) {
    const nextIndexA = (indexA + 1) % pointsA.length;
    for (let indexB = 0; indexB < pointsB.length; indexB += 1) {
      const nextIndexB = (indexB + 1) % pointsB.length;
      if (
        segmentsIntersect(
          pointsA[indexA],
          pointsA[nextIndexA],
          pointsB[indexB],
          pointsB[nextIndexB]
        )
      ) {
        return true;
      }
    }
  }

  return pointInPolygon(pointsA[0], pointsB) || pointInPolygon(pointsB[0], pointsA);
}

export function brightenHexColor(hexColor, amount = 40) {
  const raw = hexColor.replace('#', '');
  const step = Math.max(0, Math.min(255, amount));
  const channels = raw.match(/.{1,2}/g) || [];
  const updated = channels.map((channel) => {
    const value = parseInt(channel, 16);
    return Math.min(255, value + step)
      .toString(16)
      .padStart(2, '0');
  });

  return `#${updated.join('')}`;
}

export function hexToRgba(hexColor, alpha = 1) {
  const raw = hexColor.replace('#', '');
  const [r, g, b] = raw.match(/.{1,2}/g).map((channel) => parseInt(channel, 16));
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

export function deepEqualPoints(pointsA, pointsB) {
  if (pointsA.length !== pointsB.length) {
    return false;
  }

  return pointsA.every(
    (point, index) =>
      Math.abs(point.x - pointsB[index].x) < EPSILON && Math.abs(point.y - pointsB[index].y) < EPSILON
  );
}
