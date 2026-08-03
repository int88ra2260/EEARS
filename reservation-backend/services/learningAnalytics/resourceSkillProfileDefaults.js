'use strict';

/** 內建 heuristic 技能向量（resource_type 彙總鍵；resource_id = 0） */
const RESOURCE_SKILL_PROFILE_DEFAULTS = Object.freeze({
  GE: { listening: 0.25, reading: 0.35, speaking: 0.15, writing: 0.25, interaction: 0.1, mediation: 0.05, eap: 0.05, esp: 0.05 },
  EAP: { listening: 0.1, reading: 0.3, speaking: 0.05, writing: 0.5, interaction: 0.05, mediation: 0.1, eap: 0.3, esp: 0.05 },
  ESP: { listening: 0.25, reading: 0.15, speaking: 0.3, writing: 0.1, interaction: 0.3, mediation: 0.15, eap: 0.05, esp: 0.5 },
  ENGLISH_TABLE: { listening: 0.25, reading: 0.05, speaking: 0.45, writing: 0, interaction: 0.45, mediation: 0.15, eap: 0.05, esp: 0.05 },
  ENGLISH_CLUB: { listening: 0.25, reading: 0.15, speaking: 0.35, writing: 0.1, interaction: 0.35, mediation: 0.2, eap: 0.05, esp: 0.1 },
  JOB_TALK: { listening: 0.25, reading: 0.15, speaking: 0.3, writing: 0.1, interaction: 0.3, mediation: 0.15, eap: 0.05, esp: 0.5 },
  INTERNATIONAL_FORUM: { listening: 0.4, reading: 0.2, speaking: 0.25, writing: 0.1, interaction: 0.3, mediation: 0.35, eap: 0.3, esp: 0.3 },
  WORKSHOP: { listening: 0.2, reading: 0.25, speaking: 0.15, writing: 0.45, interaction: 0.25, mediation: 0.15, eap: 0.35, esp: 0.05 },
  TUTOR_IN_PERSON: { listening: 0.15, reading: 0.2, speaking: 0.25, writing: 0.4, interaction: 0.35, mediation: 0.25, eap: 0.25, esp: 0.05 },
  TUTOR_ONLINE: { listening: 0.2, reading: 0.2, speaking: 0.2, writing: 0.45, interaction: 0.3, mediation: 0.25, eap: 0.25, esp: 0.05 },
  ACTIVITY_OTHER: { listening: 0.2, reading: 0.15, speaking: 0.25, writing: 0.1, interaction: 0.25, mediation: 0.15, eap: 0.1, esp: 0.1 },
  COURSE_OTHER: { listening: 0.2, reading: 0.25, speaking: 0.15, writing: 0.25, interaction: 0.1, mediation: 0.1, eap: 0.15, esp: 0.15 },
});

const SKILL_WEIGHT_KEYS = Object.freeze([
  'listening', 'reading', 'speaking', 'writing', 'interaction', 'mediation', 'eap', 'esp',
]);

module.exports = {
  RESOURCE_SKILL_PROFILE_DEFAULTS,
  SKILL_WEIGHT_KEYS,
};
