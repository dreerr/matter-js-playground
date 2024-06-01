// https://stackoverflow.com/questions/59813806/how-to-retrieve-vector-tiles-from-mapbox-with-d3-js-and-convert-to-geojson

import * as d3 from "d3";
import { tile } from "d3-tile";
import { VectorTile } from "@mapbox/vector-tile";
import Pbf from "pbf";
import { union } from "@turf/turf";
import rewind from "@mapbox/geojson-rewind";

let height = window.innerHeight;
let width = window.innerWidth;

// create a projection for Vienna
const projection = d3
  .geoMercator()
  .center([16.3731, 48.2083])
  .scale(Math.pow(2, 26) / (2 * Math.PI))
  .translate([width / 2, height / 2])
  .precision(0);

// create a path generator
const path = d3.geoPath(projection);

// create a tile layout
const myTiles = tile()
  .size([width, height])
  .scale(projection.scale() * 2 * Math.PI)
  .translate(projection([0, 0]));

// create a function to convert vector tiles to geojson
function geojson([x, y, z], layer, filter = () => true) {
  if (!layer) return;
  const features = [];
  for (let i = 0; i < layer.length; ++i) {
    const f = layer.feature(i).toGeoJSON(x, y, z);
    if (filter.call(null, f, i, features)) features.push(f);
  }
  return { type: "FeatureCollection", features };
}

async function main() {
  // get vector tiles from eubucco tiles server
  let tiles = await Promise.all(
    myTiles().map(async (d) => {
      d.layers = new VectorTile(
        new Pbf(
          await d3.buffer(
            `https://tiles.eubucco.com/public.data_building/${d[2]}/${d[0]}/${d[1]}.pbf?properties=id,id_source,type,type_source,height,age`
          )
        )
      ).layers;
      return d;
    })
  );

  // create feature collection
  const featureCollection = {
    type: "FeatureCollection",
    features: tiles.flatMap(
      (d) => geojson(d, d.layers["public.data_building"]).features
    ),
  };

  // unionize overlapping polygons with the same id
  featureCollection.features = featureCollection.features
    .sort((a, b) => a.properties.id.localeCompare(b.properties.id))
    .reduce((acc, cur) => {
      if (acc.length === 0) {
        acc.push(cur);
      } else {
        const last = acc[acc.length - 1];
        if (last.properties.id === cur.properties.id) {
          // unionize overlapping polygons with the same id
          // alter the last feature in the accumulator, don't push the current feature
          const unionized = union(last, cur);
          /* rewinding is necessary to ensure that the polygons are in correct order
             d3.geoPath: Spherical polygons also require a winding order convention
             to determine which side of the polygon is the inside: the exterior ring
             for polygons smaller than a hemisphere must be clockwise, while the
             exterior ring for polygons larger than a hemisphere must be anticlockwise
          */
          last.geometry = rewind(unionized.geometry, true);
        } else {
          acc.push(cur);
        }
      }
      return acc;
    }, []);

  // draw to screen
  document.getElementById(
    "unionized"
  ).innerHTML = `<svg viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg">${featureCollection.features.map(
    (d) =>
      `<path fill="rgba(255,0,0,0.05)" stroke="#000" stroke-width="0.5" id="${
        d.properties.id
      }" d="${path(d)}"></path>`
  )}</svg>`;
}
main();
