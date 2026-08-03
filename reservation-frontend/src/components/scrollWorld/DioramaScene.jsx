import React from 'react';
import './diorama.css';

/**
 * CSS 等距迷你場景 — 無影片素材時的佔位 diorama
 * 各主題以純 CSS 呈現，方便後續替換為 scroll-scrub 影片
 */
export default function DioramaScene({ variant, accent }) {
  return (
    <div className="swt-diorama" data-variant={variant} style={{ '--swt-scene-accent': accent }}>
      <div className="swt-diorama__ground" aria-hidden="true" />
      <div className="swt-diorama__content" aria-hidden="true">
        {variant === 'events' && <EventsDiorama />}
        {variant === 'courses' && <CoursesDiorama />}
        {variant === 'learning' && <LearningDiorama />}
        {variant === 'other' && <OtherDiorama />}
      </div>
      <div className="swt-diorama__shadow" aria-hidden="true" />
    </div>
  );
}

function EventsDiorama() {
  return (
    <>
      <div className="swt-iso swt-iso--stage">
        <div className="swt-iso__roof" />
        <div className="swt-iso__wall swt-iso__wall--front" />
        <div className="swt-iso__wall swt-iso__wall--side" />
        <div className="swt-iso__screen" />
      </div>
      <div className="swt-iso swt-iso--seat swt-iso--seat-1" />
      <div className="swt-iso swt-iso--seat swt-iso--seat-2" />
      <div className="swt-iso swt-iso--seat swt-iso--seat-3" />
      <div className="swt-iso swt-iso--banner">ET · EC</div>
    </>
  );
}

function CoursesDiorama() {
  return (
    <>
      <div className="swt-iso swt-iso--building">
        <div className="swt-iso__roof swt-iso__roof--green" />
        <div className="swt-iso__wall swt-iso__wall--front" />
        <div className="swt-iso__wall swt-iso__wall--side" />
        <div className="swt-iso__window swt-iso__window--1" />
        <div className="swt-iso__window swt-iso__window--2" />
      </div>
      <div className="swt-iso swt-iso--desk" />
      <div className="swt-iso swt-iso--chart" />
      <div className="swt-iso swt-iso--flag">BESTEP</div>
    </>
  );
}

function LearningDiorama() {
  return (
    <>
      <div className="swt-iso swt-iso--library">
        <div className="swt-iso__roof swt-iso__roof--blue" />
        <div className="swt-iso__wall swt-iso__wall--front" />
        <div className="swt-iso__wall swt-iso__wall--side" />
        <div className="swt-iso__shelf swt-iso__shelf--1" />
        <div className="swt-iso__shelf swt-iso__shelf--2" />
        <div className="swt-iso__shelf swt-iso__shelf--3" />
      </div>
      <div className="swt-iso swt-iso--book-stack" />
      <div className="swt-iso swt-iso--lamp" />
      <div className="swt-iso swt-iso--passport">Passport</div>
    </>
  );
}

function OtherDiorama() {
  return (
    <>
      <div className="swt-iso swt-iso--plaza">
        <div className="swt-iso__floor" />
        <div className="swt-iso__pillar swt-iso__pillar--1" />
        <div className="swt-iso__pillar swt-iso__pillar--2" />
        <div className="swt-iso__fountain" />
      </div>
      <div className="swt-iso swt-iso--kiosk" />
      <div className="swt-iso swt-iso--tree swt-iso--tree-1" />
      <div className="swt-iso swt-iso--tree swt-iso--tree-2" />
      <div className="swt-iso swt-iso--sign">EEARS</div>
    </>
  );
}
