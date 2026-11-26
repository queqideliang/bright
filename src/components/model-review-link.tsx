'use client';

import Link from 'next/link';

export function ModelReviewLink({ href, active }: { href: string; active: boolean }) {
  return <Link href={href} aria-current={active ? 'page' : undefined} onClick={event => {
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button !== 0) return;
    const frame = document.querySelector<HTMLIFrameElement>('iframe[data-bv-project-viewer]');
    // Keep the active model in memory when opening its review panel.
    if (!frame?.contentDocument?.querySelector('#review-tool:not(:disabled)') || !frame.contentWindow) return;
    event.preventDefault();
    frame.contentWindow.postMessage({ type: 'bv:open-review' }, location.origin);
  }}>模型审核</Link>;
}
