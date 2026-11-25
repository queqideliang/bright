export const libraryFormats = [
  ['IFC', 'ifc'], ['BV ZIP', 'zip'], ['glTF', 'gltf', 'glb'], ['OBJ', 'obj'],
  ['STL', 'stl'], ['PLY', 'ply'], ['OFF', 'off'], ['3DS', '3ds'], ['3MF', '3mf'],
  ['AMF', 'amf'], ['Collada', 'dae'], ['FBX', 'fbx'], ['VRML', 'wrl'],
  ['dotBIM', 'bim'], ['STEP', 'step', 'stp'], ['IGES', 'iges', 'igs'], ['BREP', 'brep'],
] as const;

export const libraryExtensions = libraryFormats.flatMap(([, ...extensions]) => extensions as string[]);
export const libraryMaxBytes = 50 * 1024 * 1024;
export const libraryPageSize = 24;
export const libraryIdPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-8[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

export function modelExtension(name: string) {
  return name.includes('.') ? name.slice(name.lastIndexOf('.') + 1).toLowerCase() : '';
}

export function modelKind(name: string) {
  const extension = modelExtension(name);
  if (extension === 'zip') return 'bvzip';
  if (extension === 'ifc') return 'ifc';
  return 'geometry';
}

export interface LibraryItem {
  id: string;
  name: string;
  size: number;
  createdAt: string;
}
