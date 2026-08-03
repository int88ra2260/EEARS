/**

 * 活動預約表單區塊：學號／姓名／Email + 違規提醒 + 訊息 Alert

 */

import React from 'react';

import { Form, Alert } from 'react-bootstrap';

import { useLanguage } from '../../context/LanguageContext';



export default function EventBookingFormSection({

  studentId,

  studentName,

  studentEmail,

  onStudentIdChange,

  onStudentNameChange,

  onStudentEmailChange,

  violationWarning,

  msg,

  variant,

  isMobile,

  disabled = false,

}) {

  const { t } = useLanguage();

  const inputStyle = isMobile ? { fontSize: '16px' } : {};

  const groupClass = isMobile ? 'mb-3' : 'mb-2';



  return (

    <div className="event-booking-form">

      <h3 className="event-booking-form__title">{t('booking.formSectionTitle')}</h3>

      <Form.Group className={groupClass}>

        <Form.Label>{t('booking.formStudentId')} *</Form.Label>

        <Form.Control

          type="text"

          value={studentId}

          disabled={disabled}

          onChange={(e) => onStudentIdChange(e.target.value)}

          required={!disabled}

          style={inputStyle}

          autoComplete="username"

        />

      </Form.Group>



      <Form.Group className={groupClass}>

        <Form.Label>{t('booking.formName')} *</Form.Label>

        <Form.Control

          type="text"

          value={studentName}

          disabled={disabled}

          onChange={(e) => onStudentNameChange(e.target.value)}

          required={!disabled}

          style={inputStyle}

          autoComplete="name"

        />

      </Form.Group>



      <Form.Group className={groupClass}>

        <Form.Label>{t('booking.formEmail')} *</Form.Label>

        <Form.Control

          type="email"

          value={studentEmail}

          disabled={disabled}

          onChange={(e) => onStudentEmailChange(e.target.value)}

          required={!disabled}

          style={inputStyle}

          autoComplete="email"

        />

      </Form.Group>



      {violationWarning && (

        <Alert variant="warning" className="mt-3">

          <i className="fas fa-exclamation-triangle me-2" aria-hidden />

          <strong>{t('booking.violationRemind')}</strong>

          {violationWarning.message}

          <br />

          <small className="text-muted">{t('booking.violationContinue')}</small>

        </Alert>

      )}



      {msg && (

        <Alert variant={variant} className="mt-3" role="alert">

          {msg}

        </Alert>

      )}

    </div>

  );

}

