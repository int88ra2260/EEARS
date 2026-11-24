import React, { Suspense, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Canvas } from '@react-three/fiber';
import { ContactShadows, Html, OrbitControls } from '@react-three/drei';
import MAP_PRACTICE_BUILDINGS from './mapPracticeBuildings';
import './MapPracticePage.css';

function Building({ building, selected, onSelect }) {
  const [hovered, setHovered] = useState(false);
  const [width, height, depth] = building.size;
  const [x, z] = building.position;
  const active = selected || hovered;

  useEffect(() => () => {
    document.body.style.cursor = '';
  }, []);

  return (
    <group position={[x, height / 2, z]}>
      <mesh
        onPointerDown={(event) => {
          event.stopPropagation();
          onSelect(building.id);
        }}
        onPointerOver={(event) => {
          event.stopPropagation();
          setHovered(true);
          document.body.style.cursor = 'pointer';
        }}
        onPointerOut={() => {
          setHovered(false);
          document.body.style.cursor = '';
        }}
      >
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
  return (
    <>
      <color attach="background" args={['#eef2f7']} />
      <ambientLight intensity={0.78} />
      <directionalLight position={[5, 8, 4]} intensity={1.15} />
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]}>
        <circleGeometry args={[6.4, 64]} />
        <meshStandardMaterial color="#f7f9fc" />
      </mesh>
      <gridHelper args={[10, 10, '#b7c6dc', '#d9e2ee']} position={[0, 0.01, 0]} />
      <ContactShadows position={[0, 0, 0]} opacity={0.28} scale={12} blur={2.4} far={4} />
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
        minDistance={4.5}
        maxDistance={12}
        target={[0, 0.45, 0]}
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
        <Canvas camera={{ position: [6.2, 4.8, 6.2], fov: 42 }} dpr={[1, 1.5]}>
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
          拖曳可以旋轉，滾輪可以拉近。這頁不在導覽列，也不會蓋上首頁。
          要改建築的名稱、顏色或位置，編輯 <code>mapPracticeBuildings.js</code>。
        </p>
        <div>
          <p className="map-practice__summary">{selected.name}</p>
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
                {building.name}
              </button>
            </li>
          ))}
        </ul>
      </aside>
    </div>
  );
}
