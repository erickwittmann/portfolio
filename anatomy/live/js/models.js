export function loadModel(loader, url, onLoad, onProgress, onError) {
  if (!window.__aocPacked) return loader.load(url, onLoad, onProgress, onError);
  const file = url.split("?")[0];
  fetch(`${file}.json`)
    .then((r) => { if (!r.ok) throw new Error(`${r.status} ${file}.json`); return r.json(); })
    .then(({ glb }) => {
      const bytes = Uint8Array.from(atob(glb), (c) => c.charCodeAt(0));
      loader.parse(bytes.buffer, file.slice(0, file.lastIndexOf("/") + 1), onLoad, onError);
    })
    .catch(onError);
}

export function loadModelAsync(loader, url) {
  return new Promise((resolve, reject) => loadModel(loader, url, resolve, undefined, reject));
}
