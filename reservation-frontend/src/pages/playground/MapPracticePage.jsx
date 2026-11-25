import React, { Suspense, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Canvas } from '@react-three/fiber';
import { ContactShadows, Html, OrbitControls, useGLTF } from '@react-three/drei';
import * as THREE from 'three';
import MAP_PRACTICE_BUILDINGS from './mapPracticeBuildings';
import './MapPracticePage.css';

function frameOf(buildings) {
  const points = buildings.flatMap((building) => building.footprint || [building.position]);
  const xs = points.map((point) => point[0]);
  const zs = points.map((point) => point[1]);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minZ = Math.min(...zs);
  const maxZ = Math.max(...zs);
  return {
    center: [(minX + maxX) / 2, (minZ + maxZ) / 2],
    span: Math.max(maxX - minX, maxZ - minZ),
  };
}

const SCENE_FRAME = frameOf(MAP_PRACTICE_BUILDINGS);

function usePointerTarget(onSelect, id) {
  const [hovered, setHovered] = useState(false);

  useEffect(() => () => {
    document.body.style.cursor = '';
  }, []);

  const pointerProps = {
    onPointerDown: (event) => {
      event.stopPropagation();
      onSelect(id);
    },
    onPointerOver: (event) => {
      event.stopPropagation();
      setHovered(true);
      document.body.style.cursor = 'pointer';
    },
    onPointerOut: () => {
      setHovered(false);
      document.body.style.cursor = '';
    },
  };

  return [hovered, pointerProps];
}

function ModelBuilding({ building, selected, onSelect }) {
  const { scene } = useGLTF(building.model);
  const fitted = useMemo(() => {
    const clone = scene.clone(true);
    clone.traverse((node) => {
      if (!node.isMesh || !node.material) return;
      node.material = node.material.clone();
    });
    const bounds = new THREE.Box3().setFromObject(clone);
    const center = bounds.getCenter(new THREE.Vector3());
    const size = bounds.getSize(new THREE.Vector3());
    return {
      clone,
      size,
      offset: [-center.x, -bounds.min.y, -center.z],
    };
  }, [scene]);
  const [hovered, pointerProps] = usePointerTarget(onSelect, building.id);
  const active = selected || hovered;
  const scale = building.modelScale || 1;
  const [x, z] = building.position;

  useEffect(() => {
    fitted.clone.traverse((node) => {
      if (!node.isMesh || !node.material?.emissive) return;
      node.material.emissive.set(active ? '#ffffff' : '#000000');
      node.material.emissiveIntensity = selected ? 0.22 : hovered ? 0.1 : 0;
    });
  }, [active, fitted.clone, hovered, selected]);

  return (
    <group position={[x, 0, z]}>
      <group scale={scale}>
        <primitive object={fitted.clone} position={fitted.offset} {...pointerProps} />
      </group>
      <Html
        position={[0, fitted.size.y * scale + 0.45, 0]}
        center
        distanceFactor={9}
        zIndexRange={[20, 0]}
        style={{ pointerEvents: 'none' }}
      >
        <span className="map-practice__pin">{building.place || building.name}</span>
      </Html>
    </group>
  );
}

function FootprintBuilding({ building, selected, onSelect }) {
  const [hovered, pointerProps] = usePointerTarget(onSelect, building.id);
  const height = building.size[1];
  const geometry = useMemo(() => {
    const shape = new THREE.Shape();
    building.footprint.forEach(([x, z], index) => {
      const shapeY = -z;
      if (index === 0) shape.moveTo(x, shapeY);
      else shape.lineTo(x, shapeY);
    });
    const extruded = new THREE.ExtrudeGeometry(shape, { depth: height, bevelEnabled: false });
    extruded.rotateX(-Math.PI / 2);
    return extruded;
  }, [building.footprint, height]);
  const active = selected || hovered;
  const [x, z] = building.position;

  useEffect(() => () => geometry.dispose(), [geometry]);

  return (
    <group>
      <mesh geometry={geometry} position={[0, 0.02, 0]} {...pointerProps}>
        <meshStandardMaterial
          color={building.color}
          emissive={active ? '#ffffff' : '#000000'}
          emissiveIntensity={selected ? 0.28 : hovered ? 0.14 : 0}
        />
      </mesh>
      <Html
        position={[x, height + 0.45, z]}
        center
        distanceFactor={9}
        zIndexRange={[20, 0]}
        style={{ pointerEvents: 'none' }}
      >
        <span className="map-practice__pin">{building.place}</span>
      </Html>
    </group>
  );
}

function Building({ building, selected, onSelect }) {
  const [hovered, pointerProps] = usePointerTarget(onSelect, building.id);
  const [width, height, depth] = building.size;
  const [x, z] = building.position;
  const active = selected || hovered;

  if (building.model) {
    return <ModelBuilding building={building} selected={selected} onSelect={onSelect} />;
  }

  if (building.footprint) {
    return <FootprintBuilding building={building} selected={selected} onSelect={onSelect} />;
  }

  return (
    <group position={[x, height / 2, z]} {...pointerProps}>
      <mesh>
        <boxGeometry args={[width, height, depth]} />
        <meshStandardMaterial
          color={building.color}
          emissive={active ? '#ffffff' : '#000000'}
          emissiveIntensity={selected ? 0.28 : hovered ? 0.14 : 0}
        />
      </mesh>
      <Html
        position={[0, height / 2 + 0.28, 0]}
        center
        distanceFactor={9}
        zIndexRange={[20, 0]}
        style={{ pointerEvents: 'none' }}
      >
        <span className="map-practice__pin">{building.name}</span>
      </Html>
    </group>
  );
}

function PracticeScene({ selectedId, onSelect }) {
  const [centerX, centerZ] = SCENE_FRAME.center;
  const ground = Math.ceil(SCENE_FRAME.span * 1.35);

  return (
    <>
      <color attach="background" args={['#eef2f7']} />
      <ambientLight intensity={0.78} />
      <directionalLight position={[5, 8, 4]} intensity={1.15} />
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[centerX, 0, centerZ]}>
        <circleGeometry args={[ground / 2, 64]} />
        <meshStandardMaterial color="#f7f9fc" />
      </mesh>
      <gridHelper args={[ground, 24, '#b7c6dc', '#d9e2ee']} position={[centerX, 0.01, centerZ]} />
      <ContactShadows position={[centerX, 0, centerZ]} opacity={0.28} scale={ground} blur={2.4} far={6} />
      {MAP_PRACTICE_BUILDINGS.map((building) => (
        <Building
          key={building.id}
          building={building}
          selected={building.id === selectedId}
          onSelect={onSelect}
        />
      ))}
      <OrbitControls
        makeDefault
        enablePan={false}
        maxPolarAngle={Math.PI / 2.12}
        minDistance={8}
        maxDistance={SCENE_FRAME.span * 2.4}
        target={[SCENE_FRAME.center[0], 0.7, SCENE_FRAME.center[1]]}
      />
    </>
  );
}

export default function MapPracticePage() {
  const [selectedId, setSelectedId] = useState(MAP_PRACTICE_BUILDINGS[0].id);
  const selected = MAP_PRACTICE_BUILDINGS.find((item) => item.id === selectedId)
    || MAP_PRACTICE_BUILDINGS[0];

  return (
    <div className="map-practice">
      <div className="map-practice__stage" aria-hidden="true">
        <Canvas
          camera={{
            position: [
              SCENE_FRAME.center[0] + SCENE_FRAME.span * 0.85,
              SCENE_FRAME.span * 0.72,
              SCENE_FRAME.center[1] + SCENE_FRAME.span * 0.85,
            ],
            fov: 42,
          }}
          dpr={[1, 1.5]}
        >
          <Suspense fallback={null}>
            <PracticeScene selectedId={selected.id} onSelect={setSelectedId} />
          </Suspense>
        </Canvas>
      </div>

      <aside className="map-practice__panel">
        <div>
          <p className="map-practice__kicker">練習場</p>
          <h1 className="map-practice__title">3D 地圖</h1>
        </div>
        <p className="map-practice__note">
          拖曳可以旋轉，滾輪可以拉近。海工館是 Blender 匯出的模型，另外三棟是 OpenStreetMap 的建物輪廓。
          1 單位是 10 公尺。資料寫在 <code>mapPracticeBuildings.js</code>。© OpenStreetMap 貢獻者。
        </p>
        <div>
          <p className="map-practice__summary">{selected.place || selected.name}</p>
          <p className="map-practice__body">{selected.summary}</p>
          <Link className="map-practice__link" to={selected.href}>
            前往{selected.name}
          </Link>
        </div>
        <ul className="map-practice__list">
          {MAP_PRACTICE_BUILDINGS.map((building) => (
            <li key={building.id}>
              <button
                type="button"
                className="map-practice__choice"
                aria-pressed={building.id === selected.id}
                onClick={() => setSelectedId(building.id)}
              >
                <span className="map-practice__swatch" style={{ background: building.color }} />
                {building.place || building.name}
              </button>
            </li>
          ))}
        </ul>
      </aside>
    </div>
  );
}
