import Matter from "matter-js";
import { loadSVGPaths, getSVGBoundingBox, parsePath } from "./svg.js";
import decomp from "poly-decomp";

// Set decomp as global
Matter.Common.setDecomp(decomp);

const canvas = document.getElementById("world");
canvas.width = window.innerWidth;
canvas.height = window.innerHeight;

const engine = Matter.Engine.create({
  gravity: { x: 0, y: 0 },
});
const render = Matter.Render.create({
  canvas: canvas,
  engine: engine,
  options: {
    width: window.innerWidth,
    height: window.innerHeight,
    pixelRatio: "auto",
    wireframes: false,
    background: "white", // Set the canvas background to white
  },
});

Matter.Render.run(render);
Matter.Runner.run(Matter.Runner.create(), engine);

// Create borders
const borderThickness = 50;
const createBorders = () => {
  const width = window.innerWidth;
  const height = window.innerHeight;
  return [
    Matter.Bodies.rectangle(
      width / 2,
      -borderThickness / 2,
      width,
      borderThickness,
      { isStatic: true, label: "border" }
    ), // Top
    Matter.Bodies.rectangle(
      width / 2,
      height + borderThickness / 2,
      width,
      borderThickness,
      { isStatic: true, label: "border" }
    ), // Bottom
    Matter.Bodies.rectangle(
      -borderThickness / 2,
      height / 2,
      borderThickness,
      height,
      { isStatic: true, label: "border" }
    ), // Left
    Matter.Bodies.rectangle(
      width + borderThickness / 2,
      height / 2,
      borderThickness,
      height,
      { isStatic: true, label: "border" }
    ), // Right
  ];
};

// Calculate centroid of vertices
function calculateCentroid(vertices) {
  let centroid = { x: 0, y: 0 };
  vertices.forEach((vertex) => {
    centroid.x += vertex.x;
    centroid.y += vertex.y;
  });
  centroid.x /= vertices.length;
  centroid.y /= vertices.length;
  return centroid;
}

// Create Matter.js body from vertices
function createBody(vertices) {
  try {
    const centroid = calculateCentroid(vertices);
    const body = Matter.Bodies.fromVertices(
      centroid.x,
      centroid.y,
      [vertices],
      {
        render: {
          fillStyle: "black",
        },
      },
      false,
      0,
      0,
      0
    );
    Matter.World.add(engine.world, body);
  } catch (error) {
    console.error("Failed to create body from vertices:", vertices, error);
  }
}

// Process paths in batches
async function processPaths(paths) {
  const boundingBox = getSVGBoundingBox(paths);
  const svgWidth = boundingBox.maxX - boundingBox.minX;
  const svgHeight = boundingBox.maxY - boundingBox.minY;

  const canvasWidth = window.innerWidth;
  const canvasHeight = window.innerHeight;

  const scaleX = canvasWidth / svgWidth;
  const scaleY = canvasHeight / svgHeight;
  const scale = Math.min(scaleX, scaleY);

  const offsetX = boundingBox.minX;
  const offsetY = boundingBox.minY;

  for (let i = 0; i < paths.length; i += 50) {
    // Reduced batch size
    const batch = paths.slice(i, i + 50);
    batch.forEach((pathData) => {
      try {
        const vertices = parsePath(pathData, scale, offsetX, offsetY);
        if (vertices.length > 2) {
          createBody(vertices);
        } else {
          console.warn("Insufficient vertices to form a body:", vertices);
        }
      } catch (error) {
        console.error("Error processing path:", pathData, error);
      }
    });
    await new Promise(requestAnimationFrame); // Yield to allow UI update
  }
}

// Initialize
async function init(city) {
  Matter.World.clear(engine.world);
  Matter.Engine.clear(engine);
  let borders = createBorders();
  Matter.World.add(engine.world, borders);
  try {
    console.log("Loading city:", city);
    const svgPaths = await loadSVGPaths(city);
    console.log("Loaded SVG Paths:", svgPaths.length);
    await processPaths(svgPaths);
    engine.positionIterations = 6; // Reduced iterations
    engine.velocityIterations = 4; // Reduced iterations
    Matter.Engine.update(engine, 1000 / 60);
    Matter.Events.on(engine, "afterUpdate", applyAttraction);

    // Make shapes draggable
    const mouse = Matter.Mouse.create(canvas);
    const mouseConstraint = Matter.MouseConstraint.create(engine, {
      mouse: mouse,
      constraint: {
        stiffness: 0.2,
        render: {
          visible: false,
        },
      },
    });
    Matter.World.add(engine.world, mouseConstraint);
  } catch (error) {
    console.error("Error initializing SVG paths:", error);
  }
}

function applyAttraction() {
  const bodies = Matter.Composite.allBodies(engine.world).filter(
    (body) => body.label !== "border"
  );

  // Calculate areas and sort bodies by area
  const bodyAreas = bodies
    .map((body) => ({
      body,
      area: Matter.Vertices.area(body.vertices),
    }))
    .sort((a, b) => b.area - a.area);

  // Get the five largest bodies
  const largestBodies = bodyAreas.slice(0, 5).map((entry) => entry.body);

  // Apply attraction from the five largest bodies to all other bodies
  for (const bodyA of largestBodies) {
    for (const bodyB of bodies) {
      if (bodyA !== bodyB) {
        const dx = bodyA.position.x - bodyB.position.x;
        const dy = bodyA.position.y - bodyB.position.y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        const forceMagnitude = (0.000001 * bodyA.mass) / (distance * distance);
        const force = { x: dx * forceMagnitude, y: dy * forceMagnitude };
        Matter.Body.applyForce(bodyB, bodyB.position, force);
      }
    }
  }
}

window.initMatterJs = init;
