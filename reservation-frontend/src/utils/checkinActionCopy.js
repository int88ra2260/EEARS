function studentLine(reservation) {
  const name = reservation?.studentName || reservation?.name || '這位學生';
  const sid = reservation?.studentId ? `（${reservation.studentId}）` : '';
  return `${name}${sid}`;
}

function passportWarning(reservation) {
  if (reservation?.passportPointsStatus === 'granted') {
    return '這場已入的護照點數會收回。';
  }
  if (reservation?.countsTowardPassport || reservation?.passportPointsStatus === 'pending') {
    return '已標記的護照點數會取消，不會補發。';
  }
  return '';
}

export function buildCheckinConfirm({
  reservation,
  excludeFromClassCredit = false,
  countsTowardPassport = false,
  isBackdate = false,
  eventDate = '',
} = {}) {
  const who = studentLine(reservation);
  const when = isBackdate && eventDate ? `活動日期是 ${eventDate}。` : '';

  if (excludeFromClassCredit) {
    return {
      title: '確認到場不計點？',
      description: who,
      consequence: `這場記為已到，不計課堂加分，也不記未到。${when}`,
      confirmText: '確認到場不計點',
      cancelText: '返回',
      variant: 'secondary',
    };
  }

  const action = isBackdate ? '補簽到' : '簽到';
  if (countsTowardPassport) {
    return {
      title: `確認${action}並計入護照？`,
      description: who,
      consequence: `這場計入護照點數，不計課堂加分。${when}`,
      confirmText: '確認計入護照',
      cancelText: '返回',
      variant: 'primary',
    };
  }

  return {
    title: `確認${action}？`,
    description: who,
    consequence: `這場會計入課堂加分。${when}`,
    confirmText: `確認${action}`,
    cancelText: '返回',
    variant: 'success',
  };
}

export function buildCorrectionConfirm({ reservation, mode } = {}) {
  const who = studentLine(reservation);
  const passport = passportWarning(reservation);

  const allocatedNote = '若學生已把這場時數分到課堂，已分配的時數不會自動退回。';

  if (mode === 'undo') {
    return {
      title: '取消這次簽到？',
      description: who,
      consequence: `會回到待簽到，可以再選一次。${passport}${allocatedNote}`,
      confirmText: '取消簽到',
      cancelText: '保留現況',
      variant: 'danger',
    };
  }

  if (mode === 'attendance_only') {
    return {
      title: '改為到場不計點？',
      description: who,
      consequence: `這場改為不計課堂加分，也不記未到。${passport}${allocatedNote}`,
      confirmText: '改為不計點',
      cancelText: '保留現況',
      variant: 'secondary',
    };
  }

  return {
    title: '改為計入課堂加分？',
    description: who,
    consequence: '這場改為計入課堂加分。',
    confirmText: '改計課堂加分',
    cancelText: '保留現況',
    variant: 'success',
  };
}
