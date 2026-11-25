const scene = document.getElementById('scene');
let embedded;
function reportError(message) {
  scene.dataset.state = 'error';
  window.parent.postMessage({ type: 'bv-geometry-error', message }, location.origin);
}
window.addEventListener('message', event => {
  if (event.origin !== location.origin || event.source !== window.parent || event.data?.type !== 'bv-open-geometry') return;
  const file = event.data.file;
  if (!(file instanceof File) || file.size === 0 || file.size > 50 * 1024 * 1024 || embedded) return;
  try {
    embedded = new OV.EmbeddedViewer(scene, {
      backgroundColor: new OV.RGBAColor(237, 242, 245, 255), defaultColor: new OV.RGBColor(94, 144, 170),
      onModelLoaded() {
        const model = embedded.GetModel();
        const triangles = model.TriangleCount(), lines = model.LineCount(), vertices = model.VertexCount();
        if (!vertices || (!triangles && !lines)) { reportError('文件中没有可显示的曲面或线条。'); return; }
        scene.dataset.state = 'ready';
        scene.dataset.triangles = String(triangles);
        document.getElementById('summary').textContent = model.MeshCount() + ' 个网格 · ' +
          triangles.toLocaleString('zh-CN') + ' 个三角面' + (lines ? ' · ' + lines + ' 条线' : '');
        document.getElementById('tools').hidden = false;
        window.parent.postMessage({ type: 'bv-geometry-loaded' }, location.origin);
      },
      onModelLoadFailed() {
        const detail = embedded.progressDiv?.textContent || '';
        reportError('模型解析失败。请检查文件是否完整、引用的几何是否已内嵌。' + (detail ? ' ' + detail.slice(0, 240) : ''));
      },
    });
    embedded.LoadModelFromFileList([file]);
  } catch (error) {
    reportError('无法初始化三维视图，请检查浏览器的 WebGL 支持。' + (error instanceof Error ? ' ' + error.message : ''));
  }
});
document.getElementById('fit').addEventListener('click', () => {
  const viewer = embedded?.GetViewer();
  if (viewer) viewer.FitSphereToWindow(viewer.GetBoundingSphere(() => true), false);
});
window.addEventListener('error', () => reportError('三维解析器未能完成。请检查文件、设备内存或重新打开。'));
window.addEventListener('unhandledrejection', () => reportError('三维解析中断，请重新打开或检查模型的依赖文件。'));
window.addEventListener('pagehide', () => embedded?.Destroy(), { once: true });
