const EDGE_VISIBILITY_PX = 48;

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function looseWindowLimits(current, workArea) {
  return {
    minX: workArea.x - current.width + EDGE_VISIBILITY_PX,
    maxX: workArea.x + workArea.width - EDGE_VISIBILITY_PX,
    minY: workArea.y - current.height + EDGE_VISIBILITY_PX,
    maxY: workArea.y + workArea.height - EDGE_VISIBILITY_PX
  };
}

function clampLooseWindowPosition(current, workArea, requestedX, requestedY) {
  const limits = looseWindowLimits(current, workArea);
  return {
    x: clamp(Math.round(requestedX), limits.minX, limits.maxX),
    y: clamp(Math.round(requestedY), limits.minY, limits.maxY)
  };
}

module.exports = {
  EDGE_VISIBILITY_PX,
  clampLooseWindowPosition,
  looseWindowLimits
};
