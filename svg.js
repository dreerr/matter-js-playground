import SVGPathParser from 'svg-path-parser';
import simplify from 'simplify-js';

// Load SVG and extract paths inside #PatchCollection_1
export async function loadSVGPaths() {
  const response = await fetch('Alsergrund.svg');
  const svgText = await response.text();
  const parser = new DOMParser();
  const svgDoc = parser.parseFromString(svgText, 'image/svg+xml');
  const pathElements = svgDoc.querySelectorAll('#PatchCollection_1 path');

  return Array.from(pathElements).map(path => path.getAttribute('d'));
}

// Calculate the bounding box of all SVG paths
export function getSVGBoundingBox(paths) {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;

  paths.forEach(pathData => {
    const parsed = SVGPathParser(pathData);
    parsed.forEach(segment => {
      if (segment.x === undefined || segment.y === undefined) console.log(segment);
      if (segment.code === 'M' || segment.code === 'L') {
        if (segment.x < minX) minX = segment.x;
        if (segment.y < minY) minY = segment.y;
        if (segment.x > maxX) maxX = segment.x;
        if (segment.y > maxY) maxY = segment.y;
      }
    });
  });

  return { minX, minY, maxX, maxY };
}

// Parse and simplify path data, and scale to fit the canvas
export function parsePath(pathData, scale, offsetX, offsetY) {
  const parsed = SVGPathParser(pathData);

  let mCodeCount = 0;
  const vertices = parsed.filter(segment => segment.code === 'M' || segment.code === 'L')
    .filter(segment => {
      if (segment.code === 'M') mCodeCount++;
      return mCodeCount < 2;
    })
    .map(segment => ({ x: (segment.x - offsetX) * scale, y: (segment.y - offsetY) * scale }));
  // return vertices;
  return simplify(vertices, 0.3, true); // Increased tolerance for simplification
}
