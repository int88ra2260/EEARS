import React, { useState } from 'react';
import { Alert, Button, Collapse, Table } from 'react-bootstrap';
import { ANNOUNCEMENT_WORKFLOW_ROWS } from '../../../constants/announcementLabels';

export default function AnnouncementWorkflowGuide() {
  const [open, setOpen] = useState(false);

  return (
    <Alert variant="light" className="border mb-3 py-2">
      <div className="d-flex flex-wrap justify-content-between align-items-start gap-2">
        <div className="small" style={{ flex: '1 1 280px' }}>
          <strong>下架 vs 封存：</strong>
          <span className="text-muted ms-1">
            兩者都會讓前台看不到，但用途不同——
            <strong className="text-body fw-semibold">下架</strong>是暫時隱藏、之後常會再發；
            <strong className="text-body fw-semibold">封存</strong>是長期歸檔、不再當現行公告。
          </span>
        </div>
        <Button
          variant="link"
          size="sm"
          className="p-0 text-nowrap align-self-start"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
        >
          {open ? '收合說明' : '查看對照表'}
        </Button>
      </div>

      <Collapse in={open}>
        <div className="mt-2 pt-2 border-top">
          <Table size="sm" responsive className="mb-0 small align-middle">
            <thead>
              <tr>
                <th style={{ width: '72px' }}>操作</th>
                <th>什麼時候用</th>
                <th style={{ width: '88px' }}>前台</th>
                <th style={{ width: '140px' }}>如何恢復</th>
              </tr>
            </thead>
            <tbody>
              {ANNOUNCEMENT_WORKFLOW_ROWS.map((row) => (
                <tr key={row.action}>
                  <td className="fw-semibold">{row.action}</td>
                  <td className="text-muted">{row.suitable}</td>
                  <td>{row.frontend}</td>
                  <td>{row.recover}</td>
                </tr>
              ))}
            </tbody>
          </Table>
        </div>
      </Collapse>
    </Alert>
  );
}
