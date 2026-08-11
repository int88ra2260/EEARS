// utils/emailQueue.js
// Email 佇列系統，支援非阻塞發送與失敗重試

const { sendEmail, emailTemplates } = require('../config/email');
const { logEmailAsync } = require('../services/emailLogService');
const { randomUUID } = require('crypto');

function delay(ms) {
  return new Promise((resolve) => {
    const timer = setTimeout(resolve, ms);
    if (typeof timer.unref === 'function') timer.unref();
  });
}

class EmailQueue {
  constructor() {
    this.queue = [];
    this.processing = false;
    this.maxRetries = 3;
    this.retryDelay = 60000; // 1 分鐘
  }

  // 加入郵件到佇列
  async enqueue(template, data, options = {}) {
    const emailJob = {
      id: Date.now() + Math.random(),
      template,
      data,
      retries: 0,
      maxRetries: options.maxRetries || this.maxRetries,
      createdAt: new Date(),
      requestId: options.requestId || `emailjob:${randomUUID()}`,
      relatedEntityType: options.relatedEntityType || null,
      relatedEntityId: options.relatedEntityId || null,
      ...options
    };

    this.queue.push(emailJob);
    console.log(`📧 Email added to queue: ${template} (Queue size: ${this.queue.length})`);

    // 非阻塞處理
    if (!this.processing) {
      this.processQueue();
    }

    return emailJob.id;
  }

  // 處理佇列
  async processQueue() {
    if (this.processing || this.queue.length === 0) {
      return;
    }

    this.processing = true;

    while (this.queue.length > 0) {
      const job = this.queue.shift();

      try {
        await this.sendEmailWithRetry(job);
      } catch (error) {
        console.error(`❌ Email job ${job.id} failed after ${job.maxRetries} retries:`, error);
        // 可以選擇將失敗的郵件記錄到資料庫或日誌檔案
      }

      // 避免阻塞，每次發送後稍作延遲
      await delay(100);
    }

    this.processing = false;
  }

  // 發送郵件並重試
  async sendEmailWithRetry(job) {
    while (job.retries <= job.maxRetries) {
      let mailMeta = { to: null, subject: null };
      try {
        // eslint-disable-next-line global-require
        const { buildMailOptions } = require('../services/emailTemplateService');
        const opts = await buildMailOptions(job.template, job.data);
        mailMeta.to = opts.to || job.data?.studentEmail || job.data?.email || null;
        mailMeta.subject = opts.subject || null;
      } catch (e) {
        if (e && e.code === 'EMAIL_TEMPLATE_DISABLED') {
          logEmailAsync({
            to: job.data?.studentEmail || job.data?.email || null,
            subject: null,
            template: job.template,
            status: 'skipped',
            errorMessage: 'EMAIL_TEMPLATE_DISABLED',
            relatedEntityType: job.relatedEntityType,
            relatedEntityId: job.relatedEntityId,
            requestId: job.requestId,
          });
          return;
        }
        // 發送端失敗時也要儘量記錄 meta（不影響重試）
        try {
          const fn = emailTemplates && emailTemplates[job.template];
          if (typeof fn === 'function') {
            const opts = fn(job.data) || {};
            mailMeta.to = opts.to || job.data?.studentEmail || job.data?.email || null;
            mailMeta.subject = opts.subject || null;
          }
        } catch (_) {
          /* ignore */
        }
      }

      try {
        const result = await sendEmail(job.template, job.data);
        if (result && result.skipped) {
          logEmailAsync({
            to: mailMeta.to,
            subject: mailMeta.subject,
            template: job.template,
            status: 'skipped',
            errorMessage: result.reason || 'skipped',
            relatedEntityType: job.relatedEntityType,
            relatedEntityId: job.relatedEntityId,
            requestId: job.requestId,
          });
          return;
        }
        logEmailAsync({
          to: mailMeta.to,
          subject: mailMeta.subject,
          template: job.template,
          status: 'success',
          errorMessage: null,
          relatedEntityType: job.relatedEntityType,
          relatedEntityId: job.relatedEntityId,
          requestId: job.requestId,
        });
        return;
      } catch (error) {
        const shouldRetry = job.retries < job.maxRetries;

        logEmailAsync({
          to: mailMeta.to,
          subject: mailMeta.subject,
          template: job.template,
          status: shouldRetry ? 'retry' : 'failed',
          errorMessage: error && error.message ? error.message : String(error),
          relatedEntityType: job.relatedEntityType,
          relatedEntityId: job.relatedEntityId,
          requestId: job.requestId,
        });

        job.retries += 1;

        if (shouldRetry) {
          await delay(this.retryDelay);
        } else {
          throw new Error(`Email failed after ${job.maxRetries} retries: ${error.message}`);
        }
      }
    }
  }

  // 取得佇列狀態
  getQueueStatus() {
    return {
      queueSize: this.queue.length,
      processing: this.processing,
      totalProcessed: this.totalProcessed || 0
    };
  }
}

// 單例模式
const emailQueue = new EmailQueue();

module.exports = emailQueue;

