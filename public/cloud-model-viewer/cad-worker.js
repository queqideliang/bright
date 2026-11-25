importScripts('./vendor/occt/occt-import-js.js');

const directory = new URL('./vendor/occt/', self.location.href);
let kernel;
self.onmessage = async ({ data }) => {
  try {
    kernel ??= occtimportjs({ locateFile: name => new URL(name, directory).href });
    const occt = await kernel;
    self.postMessage(occt.ReadFile(data.format, data.buffer, data.params));
  } catch {
    self.postMessage({ success: false });
  }
};
