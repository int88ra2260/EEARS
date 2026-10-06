import React from 'react';
import SystemErrorPage from '../../pages/SystemErrorPage';
import { isStaleChunkLoadError, reloadOnceForStaleChunk } from '../../utils/chunkLoadRecovery';

function extractRequestId(error) {
  if (!error) return null;
  if (error.requestId) return error.requestId;
  if (error?.response?.headers) {
    const h = error.response.headers;
    return h.get?.('x-request-id') || h.get?.('X-Request-Id') || h['x-request-id'] || h['X-Request-Id'] || null;
  }
  if (typeof error.message === 'string') {
    const m = error.message.match(/requestId:\s*([A-Za-z0-9:_-]+)/i);
    return m?.[1] || null;
  }
  return null;
}

export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, recoveringChunk: false };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error, recoveringChunk: isStaleChunkLoadError(error) };
  }

  componentDidCatch(error, errorInfo) {
    if (this.state.recoveringChunk) {
      if (!reloadOnceForStaleChunk(error)) {
        this.setState({ recoveringChunk: false });
      }
      return;
    }
    // eslint-disable-next-line no-console
    console.error('[System ErrorBoundary caught]', error, errorInfo);
  }

  render() {
    if (this.state.recoveringChunk) return null;
    if (this.state.hasError) {
      return <SystemErrorPage requestId={extractRequestId(this.state.error)} />;
    }

    return this.props.children;
  }
}

