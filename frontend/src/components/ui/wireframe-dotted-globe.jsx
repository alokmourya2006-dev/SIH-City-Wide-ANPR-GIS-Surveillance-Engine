import React, { useEffect, useRef, useState } from 'react';
import * as d3 from 'd3';

const LAND_DATA_URL = 'https://raw.githubusercontent.com/martynafford/natural-earth-geojson/refs/heads/master/110m/physical/ne_110m_land.json';

function pointInPolygon([x, y], polygon) {
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const [xi, yi] = polygon[i];
    const [xj, yj] = polygon[j];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) {
      inside = !inside;
    }
  }
  return inside;
}

function pointInFeature(point, feature) {
  const { geometry } = feature;
  const polygons = geometry.type === 'Polygon' ? [geometry.coordinates] : geometry.coordinates;
  return polygons.some((polygon) => (
    pointInPolygon(point, polygon[0]) && !polygon.slice(1).some((hole) => pointInPolygon(point, hole))
  ));
}

function dotsForFeature(feature, spacing = 16) {
  const dots = [];
  const [[minLng, minLat], [maxLng, maxLat]] = d3.geoBounds(feature);
  const step = spacing * 0.08;
  for (let lng = minLng; lng <= maxLng; lng += step) {
    for (let lat = minLat; lat <= maxLat; lat += step) {
      if (pointInFeature([lng, lat], feature)) dots.push([lng, lat]);
    }
  }
  return dots;
}

export default function WireframeDottedGlobe({ width = 800, height = 600, className = '' }) {
  const canvasRef = useRef(null);
  const [error, setError] = useState('');

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return undefined;
    const context = canvas.getContext('2d');
    if (!context) return undefined;

    let disposed = false;
    let landFeatures = null;
    let dots = [];
    let containerWidth = width;
    let containerHeight = height;
    const rotation = [0, 0];
    const baseRadius = { value: 0 };
    const projection = d3.geoOrthographic().clipAngle(90);
    const path = d3.geoPath().projection(projection).context(context);

    const resize = () => {
      const parent = canvas.parentElement;
      containerWidth = Math.min(width, parent?.clientWidth || window.innerWidth - 32);
      containerHeight = Math.min(height, Math.max(360, window.innerHeight - 72));
      const dpr = window.devicePixelRatio || 1;
      canvas.width = containerWidth * dpr;
      canvas.height = containerHeight * dpr;
      canvas.style.width = `${containerWidth}px`;
      canvas.style.height = `${containerHeight}px`;
      context.setTransform(dpr, 0, 0, dpr, 0, 0);
      baseRadius.value = Math.min(containerWidth, containerHeight) / 2.5;
      projection.scale(baseRadius.value).translate([containerWidth / 2, containerHeight / 2]);
      render();
    };

    const render = () => {
      context.clearRect(0, 0, containerWidth, containerHeight);
      const currentScale = projection.scale();
      const scaleFactor = currentScale / (baseRadius.value || 1);
      const centerX = containerWidth / 2;
      const centerY = containerHeight / 2;

      context.beginPath();
      context.arc(centerX, centerY, currentScale, 0, 2 * Math.PI);
      context.fillStyle = '#020617';
      context.fill();
      context.strokeStyle = 'rgba(103, 232, 249, 0.55)';
      context.lineWidth = 1.5 * scaleFactor;
      context.stroke();

      if (!landFeatures) return;
      context.beginPath();
      path(d3.geoGraticule()());
      context.strokeStyle = 'rgba(103, 232, 249, 0.18)';
      context.lineWidth = scaleFactor;
      context.stroke();

      context.beginPath();
      landFeatures.features.forEach((feature) => path(feature));
      context.strokeStyle = 'rgba(165, 243, 252, 0.78)';
      context.lineWidth = scaleFactor;
      context.stroke();

      dots.forEach(([lng, lat]) => {
        const projected = projection([lng, lat]);
        if (!projected) return;
        context.beginPath();
        context.arc(projected[0], projected[1], Math.max(0.8, 1.15 * scaleFactor), 0, 2 * Math.PI);
        context.fillStyle = 'rgba(103, 232, 249, 0.9)';
        context.fill();
      });
    };

    resize();
    window.addEventListener('resize', resize);
    const timer = d3.timer(() => {
      rotation[0] += 0.22;
      projection.rotate(rotation);
      render();
    });

    fetch(LAND_DATA_URL)
      .then((response) => {
        if (!response.ok) throw new Error('Land data request failed');
        return response.json();
      })
      .then((data) => {
        if (disposed) return;
        landFeatures = data;
        dots = data.features.flatMap((feature) => dotsForFeature(feature));
        render();
      })
      .catch(() => {
        if (!disposed) setError('Map data unavailable');
      });

    return () => {
      disposed = true;
      timer.stop();
      window.removeEventListener('resize', resize);
    };
  }, [height, width]);

  return (
    <div className={`absolute inset-0 flex items-center justify-center overflow-hidden ${className}`} aria-hidden="true">
      <canvas ref={canvasRef} className="max-w-full opacity-90" />
      {error && <span className="sr-only">{error}</span>}
    </div>
  );
}