// routes/learningPartnerRouter.js
const express = require('express');
const { logExportAudit } = require('../utils/exportAudit');
const router = express.Router();
const { Op, Sequelize, QueryTypes } = require('sequelize');
const { v4: uuidv4 } = require('uuid');
const { LearningPartnerTeam, LearningPartnerTeamMember, EnglishTestRegistration, Settings, sequelize } = require('../models');
const {
  authMiddleware,
  adminExecutiveOrDeputyMiddleware,
  requirePermission,
  P,
} = require('../middlewares/auth');

const learningPartnerAdminAuth = [
  authMiddleware,
  adminExecutiveOrDeputyMiddleware,
  requirePermission(P.CAN_MANAGE_LEARNING_PARTNER_ADMIN, '需要學習有伴團體報名管理權限'),
];
const { sendEmail } = require('../config/email');
const emailQueue = require('../utils/emailQueue');
const { isGroupRegistrationEnabled } = require('../services/registrationSettingsService');

// 輔助函數：取得設定值
async function getSetting(key, defaultValue) {
  const setting = await Settings.findOne({ where: { key } });
  if (!setting) return defaultValue;
  return setting.valueBool !== null ? setting.valueBool : (setting.value === 'true');
}

// 輔助函數：取得名額上限
async function getQuota() {
  const setting = await Settings.findOne({ where: { key: 'learning_partner_quota' } });
  return setting ? parseInt(setting.value) || 50 : 50; // 預設 50
}

// 輔助函數：檢查名額是否已滿
async function checkQuota(transaction) {
  const quota = await getQuota();
  const count = await LearningPartnerTeam.count({
    where: {
      status: { [Op.in]: ['pending_approval', 'approved'] },
      activeFlag: 1
    },
    transaction
  });
  return { quota, count, isFull: count >= quota };
}

// 輔助函數：檢查學生是否已在其他有效團體中
async function checkStudentInOtherTeam(studentId, excludeTeamId = null, transaction) {
  const where = {
    studentId,
    activeFlag: 1,
    approvalStatus: { [Op.in]: ['pending', 'approved'] }
  };
  
  const member = await LearningPartnerTeamMember.findOne({
    where,
    include: [{
      model: LearningPartnerTeam,
      as: 'team',
      where: {
        status: { [Op.in]: ['pending_approval', 'approved'] },
        activeFlag: 1
      },
      required: true
    }],
    transaction,
    lock: transaction ? Sequelize.Transaction.LOCK.UPDATE : undefined
  });

  if (!member) return null;
  if (excludeTeamId && member.teamId === excludeTeamId) return null;
  
  return {
    teamId: member.teamId,
    teamName: member.team?.teamName,
    status: member.team?.status
  };
}

// 輔助函數：產生授權連結
function generateApprovalLink(token) {
  const baseUrl = process.env.FRONTEND_URL || 'http://emieears-siwan.nsysu.edu.tw';
  return `${baseUrl}/register/english-test/group/approve?token=${token}`;
}

// 輔助函數：發送邀請郵件
async function sendInvitationEmail(member, team, isResend = false, meta = {}) {
  const approvalLink = generateApprovalLink(member.approvalToken);
  const expiresAt = new Date(member.approvalTokenExpiresAt);
  const expiresAtStr = expiresAt.toLocaleString('zh-TW', { 
    year: 'numeric', 
    month: '2-digit', 
    day: '2-digit', 
    hour: '2-digit', 
    minute: '2-digit',
    timeZone: 'Asia/Taipei'
  });

  // 取得所有成員名單（遮蔽 email）
  const allMembers = await LearningPartnerTeamMember.findAll({
    where: { teamId: team.id },
    attributes: ['studentId', 'name', 'isRepresentative'],
    order: [['isRepresentative', 'DESC'], ['createdAt', 'ASC']]
  });

  const memberList = allMembers.map(m => 
    `${m.name} (${m.studentId})${m.isRepresentative ? ' [代表]' : ''}`
  ).join('\n');

  const template = isResend ? 'learningPartnerInvitationResend' : 'learningPartnerInvitation';
  
  await emailQueue.enqueue(template, {
    email: member.email,
    name: member.name,
    studentId: member.studentId,
    teamId: team.id,
    teamName: team.teamName || `團體 #${team.id}`,
    memberList,
    approvalLink,
    expiresAt: expiresAtStr,
    expiresAtHours: 24
  }, {
    requestId: meta.requestId,
    relatedEntityType: 'learning_partner',
    relatedEntityId: team.id,
  });
}

// 輔助函數：取得 IP 和 User-Agent
function getClientInfo(req) {
  return {
    ip: req.ip || req.connection.remoteAddress || req.headers['x-forwarded-for']?.split(',')[0] || 'unknown',
    userAgent: req.headers['user-agent'] || 'unknown'
  };
}

// 錯誤碼定義
const ERROR_CODES = {
  LP_QUOTA_FULL: 'LP_QUOTA_FULL',
  LP_MEMBER_NOT_ELIGIBLE: 'LP_MEMBER_NOT_ELIGIBLE',
  LP_MEMBER_ALREADY_IN_TEAM: 'LP_MEMBER_ALREADY_IN_TEAM',
  LP_TEAM_EXPIRED: 'LP_TEAM_EXPIRED',
  LP_TOKEN_INVALID: 'LP_TOKEN_INVALID',
  LP_TOKEN_USED: 'LP_TOKEN_USED',
  LP_TOKEN_EXPIRED: 'LP_TOKEN_EXPIRED',
  LP_TEAM_NOT_FOUND: 'LP_TEAM_NOT_FOUND',
  LP_INVALID_TEAM_SIZE: 'LP_INVALID_TEAM_SIZE',
  LP_MEMBER_COUNT_MISMATCH: 'LP_MEMBER_COUNT_MISMATCH'
};

// 0. GET /api/learning-partner/quota - 查詢名額狀態（公開）
router.get('/learning-partner/quota', async (req, res) => {
  try {
    const quota = await getQuota();
    const count = await LearningPartnerTeam.count({
      where: {
        status: { [Op.in]: ['pending_approval', 'approved'] },
        activeFlag: 1
      }
    });
    
    return res.json({
      quota,
      current: count,
      remaining: Math.max(0, quota - count),
      isFull: count >= quota
    });
  } catch (error) {
    console.error('查詢名額狀態錯誤:', error);
    return res.status(500).json({
      error: '查詢名額狀態時發生錯誤',
      code: 'LP_INTERNAL_ERROR'
    });
  }
});

// 1. POST /api/learning-partner/teams - 建立團體報名
router.post('/learning-partner/teams', async (req, res) => {
  const transaction = await LearningPartnerTeam.sequelize.transaction();
  
  try {
    const { teamName, teamSize, members } = req.body;

    // 驗證輸入
    if (!teamSize || teamSize < 3 || teamSize > 4) {
      await transaction.rollback();
      return res.status(400).json({
        error: '團隊人數必須為 3~4 人',
        code: ERROR_CODES.LP_INVALID_TEAM_SIZE
      });
    }

    if (!members || !Array.isArray(members) || members.length !== teamSize) {
      await transaction.rollback();
      return res.status(400).json({
        error: `成員數量必須與團隊人數一致（${teamSize} 人）`,
        code: ERROR_CODES.LP_MEMBER_COUNT_MISMATCH
      });
    }

    // 檢查功能是否啟用（與團體報名開關同步）
    const enabled = await isGroupRegistrationEnabled();
    if (!enabled) {
      await transaction.rollback();
      return res.status(403).json({
        error: '學習有伴團體報名功能目前未開放',
        code: 'LP_FEATURE_DISABLED'
      });
    }

    // 檢查名額（使用 SELECT FOR UPDATE 鎖定）
    const quotaCheck = await checkQuota(transaction);
    if (quotaCheck.isFull) {
      await transaction.rollback();
      return res.status(409).json({
        error: `團體報名名額已滿（目前 ${quotaCheck.count}/${quotaCheck.quota}）`,
        code: ERROR_CODES.LP_QUOTA_FULL,
        quota: quotaCheck.quota,
        current: quotaCheck.count
      });
    }

    // 驗證所有成員是否已報名成功（status = 'success'）
    const ineligibleMembers = [];
    const memberData = [];

    for (const member of members) {
      if (!member.studentId || !member.name) {
        await transaction.rollback();
        return res.status(400).json({
          error: '所有成員必須提供學號和姓名',
          code: 'LP_MEMBER_DATA_INCOMPLETE'
        });
      }

      // 查詢個人報名記錄
      const registration = await EnglishTestRegistration.findOne({
        where: {
          studentId: member.studentId,
          name: member.name,
          status: 'success'
        },
        transaction,
        lock: transaction ? Sequelize.Transaction.LOCK.UPDATE : undefined
      });

      if (!registration) {
        ineligibleMembers.push({
          studentId: member.studentId,
          name: member.name,
          reason: '未完成個人培力英檢報名或報名狀態非「報名成功」'
        });
      } else {
        // 檢查是否已在其他有效團體中
        const existingTeam = await checkStudentInOtherTeam(member.studentId, null, transaction);
        if (existingTeam) {
          ineligibleMembers.push({
            studentId: member.studentId,
            name: member.name,
            reason: `已在其他團體中（團體編號：${existingTeam.teamId}，狀態：${existingTeam.status}）`
          });
        } else {
          memberData.push({
            studentId: member.studentId,
            name: member.name,
            registration,
            email: registration.email,
            personalRegistrationId: registration.id
          });
        }
      }
    }

    if (ineligibleMembers.length > 0) {
      await transaction.rollback();
      return res.status(400).json({
        error: '部分成員不符合報名資格',
        code: ERROR_CODES.LP_MEMBER_NOT_ELIGIBLE,
        ineligibleMembers
      });
    }

    // 代表者為 members[0]
    const representativeStudentId = members[0].studentId;

    // 建立團體
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + 24);

    const team = await LearningPartnerTeam.create({
      teamName: teamName || null,
      representativeStudentId,
      teamSize,
      status: 'pending_approval',
      activeFlag: 1,
      expiresAt
    }, { transaction });

    // 建立成員記錄並產生 token
    const teamMembers = [];
    for (let i = 0; i < memberData.length; i++) {
      const data = memberData[i];
      const token = uuidv4();
      const tokenExpiresAt = expiresAt;

      const member = await LearningPartnerTeamMember.create({
        teamId: team.id,
        studentId: data.studentId,
        name: data.name,
        email: data.email,
        isRepresentative: i === 0,
        personalRegistrationId: data.personalRegistrationId,
        approvalStatus: 'pending',
        activeFlag: 1,
        approvalToken: token,
        approvalTokenExpiresAt: tokenExpiresAt
      }, { transaction });

      teamMembers.push(member);
    }

    await transaction.commit();

    // 發送郵件（非阻塞，在 transaction 外）
    for (const member of teamMembers) {
      try {
        await sendInvitationEmail(member, team, false, { requestId: req.requestId });
      } catch (error) {
        console.error(`發送邀請郵件失敗 (memberId: ${member.id}):`, error);
        // 郵件失敗不影響報名成功
      }
    }

    // 回傳結果
    const membersResponse = teamMembers.map(m => ({
      studentId: m.studentId,
      name: m.name,
      email: m.email.substring(0, 3) + '***', // 遮蔽 email
      isRepresentative: m.isRepresentative,
      approvalStatus: m.approvalStatus
    }));

    return res.status(201).json({
      message: '團體報名已建立，請所有成員在 24 小時內完成同意',
      team: {
        id: team.id,
        teamName: team.teamName,
        teamSize: team.teamSize,
        status: team.status,
        expiresAt: team.expiresAt,
        members: membersResponse
      }
    });

  } catch (error) {
    await transaction.rollback();
    console.error('建立團體報名錯誤:', error);
    return res.status(500).json({
      error: '建立團體報名時發生錯誤',
      code: 'LP_INTERNAL_ERROR',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// 2. GET /api/learning-partner/teams/:teamId - 查詢團體狀態
router.get('/learning-partner/teams/:teamId', async (req, res) => {
  try {
    const { teamId } = req.params;

    const team = await LearningPartnerTeam.findByPk(teamId, {
      include: [{
        model: LearningPartnerTeamMember,
        as: 'members',
        attributes: ['id', 'studentId', 'name', 'email', 'isRepresentative', 'approvalStatus', 'approvedAt', 'approvalToken'],
        order: [['isRepresentative', 'DESC'], ['createdAt', 'ASC']]
      }]
    });

    if (!team) {
      return res.status(404).json({
        error: '找不到指定的團體',
        code: ERROR_CODES.LP_TEAM_NOT_FOUND
      });
    }

    // 計算剩餘時間
    const now = new Date();
    const expiresAt = new Date(team.expiresAt);
    const remainingMs = expiresAt - now;
    const remainingHours = Math.max(0, Math.floor(remainingMs / (1000 * 60 * 60)));
    const remainingMinutes = Math.max(0, Math.floor((remainingMs % (1000 * 60 * 60)) / (1000 * 60)));

    // 遮蔽 email
    const membersResponse = team.members.map(m => ({
      ...m.toJSON(),
      email: m.email.substring(0, 3) + '***'
    }));

    return res.json({
      team: {
        id: team.id,
        teamName: team.teamName,
        teamSize: team.teamSize,
        status: team.status,
        representativeStudentId: team.representativeStudentId,
        createdAt: team.createdAt,
        expiresAt: team.expiresAt,
        approvedAt: team.approvedAt,
        remainingHours,
        remainingMinutes,
        members: membersResponse
      }
    });

  } catch (error) {
    console.error('查詢團體狀態錯誤:', error);
    return res.status(500).json({
      error: '查詢團體狀態時發生錯誤',
      code: 'LP_INTERNAL_ERROR'
    });
  }
});

// 3. POST /api/learning-partner/approve/prepare - 準備同意頁面（二次確認前）
router.post('/learning-partner/approve/prepare', async (req, res) => {
  try {
    const { token } = req.body;

    if (!token) {
      return res.status(400).json({
        error: '請提供 token',
        code: ERROR_CODES.LP_TOKEN_INVALID
      });
    }

    const member = await LearningPartnerTeamMember.findOne({
      where: { approvalToken: token },
      include: [{
        model: LearningPartnerTeam,
        as: 'team',
        include: [{
          model: LearningPartnerTeamMember,
          as: 'members',
          attributes: ['studentId', 'name', 'isRepresentative', 'approvalStatus']
        }]
      }]
    });

    if (!member) {
      return res.status(404).json({
        error: '無效的授權連結',
        code: ERROR_CODES.LP_TOKEN_INVALID
      });
    }

    // 檢查 token 是否已使用
    if (member.approvalStatus === 'approved') {
      return res.status(400).json({
        error: '此授權連結已使用',
        code: ERROR_CODES.LP_TOKEN_USED,
        team: {
          id: member.team.id,
          teamName: member.team.teamName,
          status: member.team.status
        }
      });
    }

    // 檢查 token 是否過期
    const now = new Date();
    if (member.approvalTokenExpiresAt && new Date(member.approvalTokenExpiresAt) < now) {
      return res.status(400).json({
        error: '此授權連結已過期',
        code: ERROR_CODES.LP_TOKEN_EXPIRED,
        team: {
          id: member.team.id,
          teamName: member.team.teamName,
          status: member.team.status
        }
      });
    }

    // 檢查團體狀態
    if (member.team.status !== 'pending_approval') {
      return res.status(400).json({
        error: `團體狀態為「${member.team.status}」，無法完成同意`,
        code: ERROR_CODES.LP_TEAM_EXPIRED,
        team: {
          id: member.team.id,
          teamName: member.team.teamName,
          status: member.team.status
        }
      });
    }

    // 計算剩餘時間
    const expiresAt = new Date(member.approvalTokenExpiresAt);
    const remainingMs = expiresAt - now;
    const remainingHours = Math.max(0, Math.floor(remainingMs / (1000 * 60 * 60)));
    const remainingMinutes = Math.max(0, Math.floor((remainingMs % (1000 * 60 * 60)) / (1000 * 60)));

    // 遮蔽 email
    const membersList = member.team.members.map(m => ({
      studentId: m.studentId,
      name: m.name,
      isRepresentative: m.isRepresentative,
      approvalStatus: m.approvalStatus
    }));

    return res.json({
      member: {
        studentId: member.studentId,
        name: member.name,
        isRepresentative: member.isRepresentative
      },
      team: {
        id: member.team.id,
        teamName: member.team.teamName || `團體 #${member.team.id}`,
        teamSize: member.team.teamSize,
        status: member.team.status,
        expiresAt: member.approvalTokenExpiresAt,
        remainingHours,
        remainingMinutes,
        members: membersList
      }
    });

  } catch (error) {
    console.error('準備同意頁面錯誤:', error);
    return res.status(500).json({
      error: '準備同意頁面時發生錯誤',
      code: 'LP_INTERNAL_ERROR'
    });
  }
});

// 4. POST /api/learning-partner/approve/confirm - 確認同意
router.post('/learning-partner/approve/confirm', async (req, res) => {
  const transaction = await LearningPartnerTeamMember.sequelize.transaction();
  
  try {
    const { token } = req.body;

    if (!token) {
      await transaction.rollback();
      return res.status(400).json({
        error: '請提供 token',
        code: ERROR_CODES.LP_TOKEN_INVALID
      });
    }

    const member = await LearningPartnerTeamMember.findOne({
      where: { approvalToken: token },
      include: [{
        model: LearningPartnerTeam,
        as: 'team',
        include: [{
          model: LearningPartnerTeamMember,
          as: 'members'
        }]
      }],
      transaction,
      lock: transaction ? Sequelize.Transaction.LOCK.UPDATE : undefined
    });

    if (!member) {
      await transaction.rollback();
      return res.status(404).json({
        error: '無效的授權連結',
        code: ERROR_CODES.LP_TOKEN_INVALID
      });
    }

    // 檢查 token 是否已使用
    if (member.approvalStatus === 'approved') {
      await transaction.rollback();
      return res.status(400).json({
        error: '此授權連結已使用',
        code: ERROR_CODES.LP_TOKEN_USED
      });
    }

    // 檢查 token 是否過期
    const now = new Date();
    if (member.approvalTokenExpiresAt && new Date(member.approvalTokenExpiresAt) < now) {
      await transaction.rollback();
      return res.status(400).json({
        error: '此授權連結已過期',
        code: ERROR_CODES.LP_TOKEN_EXPIRED
      });
    }

    // 檢查團體狀態
    if (member.team.status !== 'pending_approval') {
      await transaction.rollback();
      return res.status(400).json({
        error: `團體狀態為「${member.team.status}」，無法完成同意`,
        code: ERROR_CODES.LP_TEAM_EXPIRED
      });
    }

    // 取得 IP 和 User-Agent
    const { ip, userAgent } = getClientInfo(req);

    // 更新成員同意狀態
    await member.update({
      approvalStatus: 'approved',
      approvedAt: now,
      approvalIp: ip,
      approvalUserAgent: userAgent,
      approvalToken: null // 清空 token，使其無法重用
    }, { transaction });

    // 檢查是否全員都已同意
    const allMembers = await LearningPartnerTeamMember.findAll({
      where: { teamId: member.teamId },
      transaction
    });

    const allApproved = allMembers.every(m => m.approvalStatus === 'approved');

    if (allApproved) {
      // 全員同意，更新團體狀態
      await member.team.update({
        status: 'approved',
        approvedAt: now
      }, { transaction });

      // 發送全員同意完成通知
      try {
        for (const m of allMembers) {
          await emailQueue.enqueue('learningPartnerAllApproved', {
            email: m.email,
            name: m.name,
            studentId: m.studentId,
            teamId: member.team.id,
            teamName: member.team.teamName || `團體 #${member.team.id}`,
            approvedAt: now.toLocaleString('zh-TW', { timeZone: 'Asia/Taipei' })
          }, {
            requestId: req.requestId,
            relatedEntityType: 'learning_partner',
            relatedEntityId: member.team.id,
          });
        }
      } catch (error) {
        console.error('發送全員同意通知失敗:', error);
        // 郵件失敗不影響流程
      }
    }

    await transaction.commit();

    // 回傳最新狀態
    const updatedTeam = await LearningPartnerTeam.findByPk(member.teamId, {
      include: [{
        model: LearningPartnerTeamMember,
        as: 'members',
        attributes: ['studentId', 'name', 'isRepresentative', 'approvalStatus', 'approvedAt'],
        order: [['isRepresentative', 'DESC'], ['createdAt', 'ASC']]
      }]
    });

    const membersResponse = updatedTeam.members.map(m => ({
      studentId: m.studentId,
      name: m.name,
      isRepresentative: m.isRepresentative,
      approvalStatus: m.approvalStatus,
      approvedAt: m.approvedAt
    }));

    return res.json({
      message: allApproved ? '全員同意完成！團體報名已確認。' : '同意成功！請等待其他成員完成同意。',
      team: {
        id: updatedTeam.id,
        teamName: updatedTeam.teamName,
        status: updatedTeam.status,
        approvedAt: updatedTeam.approvedAt,
        members: membersResponse
      }
    });

  } catch (error) {
    await transaction.rollback();
    console.error('確認同意錯誤:', error);
    return res.status(500).json({
      error: '確認同意時發生錯誤',
      code: 'LP_INTERNAL_ERROR'
    });
  }
});

// 5. POST /api/learning-partner/teams/:teamId/resend - 重新發送連結
router.post('/learning-partner/teams/:teamId/resend', async (req, res) => {
  const transaction = await LearningPartnerTeamMember.sequelize.transaction();
  
  try {
    const { teamId } = req.params;
    const { memberId } = req.body;

    if (!memberId) {
      await transaction.rollback();
      return res.status(400).json({
        error: '請提供 memberId'
      });
    }

    const team = await LearningPartnerTeam.findByPk(teamId, { transaction });
    if (!team) {
      await transaction.rollback();
      return res.status(404).json({
        error: '找不到指定的團體',
        code: ERROR_CODES.LP_TEAM_NOT_FOUND
      });
    }

    if (team.status !== 'pending_approval') {
      await transaction.rollback();
      return res.status(400).json({
        error: '只有「待同意」狀態的團體可以重新發送連結',
        code: ERROR_CODES.LP_TEAM_EXPIRED
      });
    }

    const member = await LearningPartnerTeamMember.findOne({
      where: {
        id: memberId,
        teamId: teamId,
        approvalStatus: 'pending'
      },
      transaction,
      lock: transaction ? Sequelize.Transaction.LOCK.UPDATE : undefined
    });

    if (!member) {
      await transaction.rollback();
      return res.status(404).json({
        error: '找不到指定的成員或該成員已同意'
      });
    }

    // Rate limit：檢查 5 分鐘內是否已重新發送過
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
    // 這裡可以加入更複雜的 rate limit 邏輯，例如記錄在 Redis 或資料庫

    // 產生新 token
    const newToken = uuidv4();
    const expiresAt = new Date(team.expiresAt);

    // 更新 token
    await member.update({
      approvalToken: newToken,
      approvalTokenExpiresAt: expiresAt
    }, { transaction });

    await transaction.commit();

    // 發送郵件
    try {
      await sendInvitationEmail(member, team, true, { requestId: req.requestId });
    } catch (error) {
      console.error('重新發送郵件失敗:', error);
      return res.status(500).json({
        error: '重新發送郵件時發生錯誤',
        code: 'LP_EMAIL_ERROR'
      });
    }

    return res.json({
      message: '已重新發送邀請連結',
      expiresAt: expiresAt
    });

  } catch (error) {
    await transaction.rollback();
    console.error('重新發送連結錯誤:', error);
    return res.status(500).json({
      error: '重新發送連結時發生錯誤',
      code: 'LP_INTERNAL_ERROR'
    });
  }
});

// 6. POST /api/learning-partner/teams/:teamId/cancel - 取消團體（管理端）
router.post('/learning-partner/teams/:teamId/cancel', ...learningPartnerAdminAuth, async (req, res) => {
  const transaction = await LearningPartnerTeam.sequelize.transaction();
  
  try {
    const { teamId } = req.params;
    const { reason } = req.body;

    const team = await LearningPartnerTeam.findByPk(teamId, {
      include: [{
        model: LearningPartnerTeamMember,
        as: 'members'
      }],
      transaction,
      lock: transaction ? Sequelize.Transaction.LOCK.UPDATE : undefined
    });

    if (!team) {
      await transaction.rollback();
      return res.status(404).json({
        error: '找不到指定的團體',
        code: ERROR_CODES.LP_TEAM_NOT_FOUND
      });
    }

    if (team.status === 'cancelled') {
      await transaction.rollback();
      return res.status(400).json({
        error: '此團體已取消'
      });
    }

    // 更新團體狀態
    await team.update({
      status: 'cancelled',
      activeFlag: 0,
      cancelledAt: new Date(),
      cancelledReason: reason || null
    }, { transaction });

    // 更新成員的 activeFlag
    await LearningPartnerTeamMember.update(
      { activeFlag: 0 },
      { where: { teamId }, transaction }
    );

    await transaction.commit();

    // 發送取消通知給已同意的成員（可選）
    const approvedMembers = team.members.filter(m => m.approvalStatus === 'approved');
    if (approvedMembers.length > 0) {
      try {
        for (const member of approvedMembers) {
          await emailQueue.enqueue('learningPartnerCancelled', {
            email: member.email,
            name: member.name,
            studentId: member.studentId,
            teamId: team.id,
            teamName: team.teamName || `團體 #${team.id}`,
            reason: reason || '管理員取消'
          }, {
            requestId: req.requestId,
            relatedEntityType: 'learning_partner',
            relatedEntityId: team.id,
          });
        }
      } catch (error) {
        console.error('發送取消通知失敗:', error);
      }
    }

    return res.json({
      message: '團體已取消',
      team: {
        id: team.id,
        status: 'cancelled'
      }
    });

  } catch (error) {
    await transaction.rollback();
    console.error('取消團體錯誤:', error);
    return res.status(500).json({
      error: '取消團體時發生錯誤',
      code: 'LP_INTERNAL_ERROR'
    });
  }
});

// 7. GET /api/admin/learning-partner/teams - 管理端列表
router.get('/admin/learning-partner/teams', ...learningPartnerAdminAuth, async (req, res) => {
  try {
    const { status, q, page = 1, limit = 20, semester } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(limit);

    const where = {};
    if (status) {
      where.status = status;
    }

    // 搜尋條件（代表者學號、成員學號、teamId）
    const include = [{
      model: LearningPartnerTeamMember,
      as: 'members',
      attributes: ['studentId', 'name', 'email', 'isRepresentative', 'approvalStatus', 'approvedAt', 'approvalIp', 'approvalUserAgent'],
      required: false,
      include: [{
        model: EnglishTestRegistration,
        as: 'personalRegistration',
        attributes: ['semester'],
        required: false
      }]
    }];

    // 學期篩選：透過個人報名關聯
    if (semester) {
      // 使用子查詢找到該學期的隊伍 ID
      const semesterTeamIds = await sequelize.query(`
        SELECT DISTINCT lpt.id
        FROM learning_partner_teams lpt
        INNER JOIN learning_partner_team_members lptm ON lpt.id = lptm.teamId
        INNER JOIN english_test_registrations etr ON lptm.personalRegistrationId = etr.id
        WHERE etr.semester = :semester AND lpt.activeFlag = 1
      `, {
        replacements: { semester },
        type: QueryTypes.SELECT
      });
      
      const teamIds = semesterTeamIds.map(row => row.id);
      if (teamIds.length > 0) {
        where.id = { [Op.in]: teamIds };
      } else {
        // 如果該學期沒有隊伍，返回空結果
        return res.json({
          teams: [],
          pagination: {
            total: 0,
            page: parseInt(page),
            limit: parseInt(limit),
            totalPages: 0
          }
        });
      }
    }

    if (q) {
      const searchTerm = `%${q}%`;
      if (!include[0].where) {
        include[0].where = {};
      }
      // 如果已經有學期篩選條件，需要合併搜尋條件
      if (include[0].where[Op.or]) {
        include[0].where[Op.and] = [
          include[0].where[Op.or],
          {
            [Op.or]: [
              { studentId: { [Op.like]: searchTerm } },
              { name: { [Op.like]: searchTerm } }
            ]
          }
        ];
        delete include[0].where[Op.or];
      } else {
        include[0].where[Op.or] = [
          { studentId: { [Op.like]: searchTerm } },
          { name: { [Op.like]: searchTerm } }
        ];
      }
      include[0].required = true;
      
      // 也搜尋代表者學號和 teamId
      const orConditions = [
        { representativeStudentId: { [Op.like]: searchTerm } }
      ];
      if (!isNaN(q)) {
        orConditions.push({ id: parseInt(q) });
      }
      // 合併現有的 where 條件
      if (where[Op.or]) {
        where[Op.and] = [
          where[Op.or],
          { [Op.or]: orConditions }
        ];
        delete where[Op.or];
      } else {
        where[Op.or] = orConditions;
      }
    }

    const { count, rows } = await LearningPartnerTeam.findAndCountAll({
      where,
      include,
      order: [['createdAt', 'ASC']], // 改為 ASC 以便計算編號
      limit: parseInt(limit),
      offset,
      distinct: true // 避免因為 JOIN 導致重複計算
    });

    // 計算該學期的隊伍編號（按建立時間排序）
    let teamSequenceMap = {};
    if (semester) {
      // 取得該學期的所有隊伍（透過個人報名關聯），按建立時間排序
      const semesterTeams = await sequelize.query(`
        SELECT DISTINCT lpt.id, lpt.createdAt
        FROM learning_partner_teams lpt
        INNER JOIN learning_partner_team_members lptm ON lpt.id = lptm.teamId
        INNER JOIN english_test_registrations etr ON lptm.personalRegistrationId = etr.id
        WHERE etr.semester = :semester AND lpt.activeFlag = 1
        ORDER BY lpt.createdAt ASC
      `, {
        replacements: { semester },
        type: QueryTypes.SELECT
      });

      semesterTeams.forEach((team, index) => {
        teamSequenceMap[team.id] = index + 1;
      });
    } else {
      // 如果沒有學期篩選，使用全局編號（按建立時間排序）
      rows.forEach((team, index) => {
        teamSequenceMap[team.id] = index + 1;
      });
    }

    // 為每個隊伍添加學期編號
    const teamsWithSequence = rows.map(team => ({
      ...team.toJSON(),
      semesterSequence: teamSequenceMap[team.id] || null
    }));

    return res.json({
      teams: teamsWithSequence,
      pagination: {
        total: count,
        page: parseInt(page),
        limit: parseInt(limit),
        totalPages: Math.ceil(count / parseInt(limit))
      }
    });

  } catch (error) {
    console.error('查詢管理端列表錯誤:', error);
    return res.status(500).json({
      error: '查詢列表時發生錯誤',
      code: 'LP_INTERNAL_ERROR'
    });
  }
});

// 8. GET /api/admin/learning-partner/teams/:teamId - 管理端詳情
router.get('/admin/learning-partner/teams/:teamId', ...learningPartnerAdminAuth, async (req, res) => {
  try {
    const { teamId } = req.params;

    const team = await LearningPartnerTeam.findByPk(teamId, {
      include: [{
        model: LearningPartnerTeamMember,
        as: 'members',
        include: [{
          model: EnglishTestRegistration,
          as: 'personalRegistration',
          attributes: ['id', 'studentId', 'name', 'email', 'status', 'hasTakenBESTEP']
        }]
      }]
    });

    if (!team) {
      return res.status(404).json({
        error: '找不到指定的團體',
        code: ERROR_CODES.LP_TEAM_NOT_FOUND
      });
    }

    return res.json({ team });

  } catch (error) {
    console.error('查詢管理端詳情錯誤:', error);
    return res.status(500).json({
      error: '查詢詳情時發生錯誤',
      code: 'LP_INTERNAL_ERROR'
    });
  }
});

// 9. GET /api/admin/learning-partner/export - 匯出（CSV/Excel）
router.get('/admin/learning-partner/export', ...learningPartnerAdminAuth, async (req, res) => {
  try {
    const { format = 'csv' } = req.query;

    const teams = await LearningPartnerTeam.findAll({
      include: [{
        model: LearningPartnerTeamMember,
        as: 'members',
        include: [{
          model: EnglishTestRegistration,
          as: 'personalRegistration',
          attributes: ['id', 'studentId', 'name', 'email']
        }]
      }],
      order: [['createdAt', 'DESC']]
    });

    if (format === 'csv') {
      // CSV 格式
      const csvRows = [];
      csvRows.push(['團體編號', '團體名稱', '代表者學號', '團體人數', '狀態', '建立時間', '過期時間', '完成時間', 
                    '成員序號', '學號', '姓名', 'Email', '是否代表', '同意狀態', '同意時間', '同意IP', '個人報名ID']);

      teams.forEach(team => {
        team.members.forEach((member, index) => {
          csvRows.push([
            team.id,
            team.teamName || '',
            team.representativeStudentId,
            team.teamSize,
            team.status,
            team.createdAt.toISOString(),
            team.expiresAt.toISOString(),
            team.approvedAt ? team.approvedAt.toISOString() : '',
            index + 1,
            member.studentId,
            member.name,
            member.email,
            member.isRepresentative ? '是' : '否',
            member.approvalStatus,
            member.approvedAt ? member.approvedAt.toISOString() : '',
            member.approvalIp || '',
            member.personalRegistrationId
          ]);
        });
      });

      const csvContent = csvRows.map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(',')).join('\n');
      const csvWithBOM = '\uFEFF' + csvContent; // 加入 BOM 以支援 Excel 中文顯示

      const memberRowCount = teams.reduce((sum, t) => sum + (t.members?.length || 0), 0);
      const exportFileName = `learning-partner-teams-${new Date().toISOString().split('T')[0]}.csv`;
      logExportAudit(req, {
        module: 'learning_partner',
        action: 'learning_partner_teams_export',
        entityType: 'LearningPartnerExport',
        entityId: `teams:${req.requestId || Date.now()}`,
        exportType: 'csv',
        reportType: 'learning_partner_teams',
        rowCount: memberRowCount,
        filters: { format: 'csv', teamCount: teams.length },
        fileName: exportFileName,
      });

      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename="${exportFileName}"`);
      return res.send(csvWithBOM);
    } else {
      // JSON 格式
      return res.json({ teams });
    }

  } catch (error) {
    console.error('匯出錯誤:', error);
    return res.status(500).json({
      error: '匯出時發生錯誤',
      code: 'LP_INTERNAL_ERROR'
    });
  }
});

module.exports = router;
