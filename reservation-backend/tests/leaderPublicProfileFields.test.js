'use strict';

const {
  normalizeProfilePayload,
  serializePublic,
} = require('../services/leaderPublicProfileFields');

describe('leader public profile fields', () => {
  test('keeps only public card fields', () => {
    const card = serializePublic({
      slug: 'ada',
      displayName: '測試 Ada',
      photoUrl: '/uploads/media/ada.jpg',
      degree: '外文系',
      experience: '',
      languages: '英語',
      focus: null,
      videoId: 'abc_12-XY',
      studentId: 'B123456789',
      email: 'ada@example.com',
      hourlyRate: 400,
      updatedBy: 9,
    });

    expect(card).toEqual({
      id: 'ada',
      name: '測試 Ada',
      photo: '/uploads/media/ada.jpg',
      degree: '外文系',
      experience: '',
      languages: '英語',
      focus: '',
      videoId: 'abc_12-XY',
    });
    expect(card).not.toHaveProperty('studentId');
    expect(card).not.toHaveProperty('email');
    expect(card).not.toHaveProperty('hourlyRate');
  });

  test('accepts a media-library photo and a youtube id', () => {
    const payload = normalizeProfilePayload({
      slug: 'Ada',
      displayName: '  測試 <b>Ada</b>  ',
      photoUrl: '/uploads/media/2026-ada.jpg',
      videoId: 'abc_12-XY',
      degree: '外文系',
    }, { isCreate: true });

    expect(payload.slug).toBe('ada');
    expect(payload.displayName).toBe('測試 Ada');
    expect(payload.photoUrl).toBe('/uploads/media/2026-ada.jpg');
    expect(payload.videoId).toBe('abc_12-XY');
  });

  test('rejects urls, external images, and missing names', () => {
    expect(() => normalizeProfilePayload({
      slug: 'ada',
      displayName: '測試 Ada',
      videoId: 'https://youtu.be/abc_12-XY',
    }, { isCreate: true })).toThrow('請填 YouTube 影片編號');

    expect(() => normalizeProfilePayload({
      slug: 'ada',
      displayName: '測試 Ada',
      photoUrl: 'https://example.com/a.jpg',
    }, { isCreate: true })).toThrow('大頭照請從媒體庫選擇');

    expect(() => normalizeProfilePayload({
      slug: 'ada',
      displayName: '   ',
    }, { isCreate: true })).toThrow('請填寫顯示名稱');
  });
});
