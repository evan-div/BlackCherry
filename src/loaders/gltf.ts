import { DRACOLoader, KTX2Loader, MeshoptDecoder } from 'three-stdlib';
import type { GLTFLoader } from 'three-stdlib';
import type { WebGLRenderer } from 'three';
import { DECODER_PATHS } from '../config/defaults';

let dracoLoader: DRACOLoader | null = null;
let ktx2Loader: KTX2Loader | null = null;

function getDracoLoader(decoderPath: string): DRACOLoader {
  if (!dracoLoader) {
    dracoLoader = new DRACOLoader();
    dracoLoader.setDecoderPath(decoderPath);
  }
  return dracoLoader;
}

function getKtx2Loader(transcoderPath: string): KTX2Loader {
  if (!ktx2Loader) {
    ktx2Loader = new KTX2Loader();
    ktx2Loader.setTranscoderPath(transcoderPath);
  }
  return ktx2Loader;
}

/**
 * Configures a GLTFLoader with Draco, Meshopt, and KTX2 support. Passed as the
 * `extensions` callback to drei's `useGLTF(url, undefined, undefined, configureLoader)`.
 * Decoders/transcoders are self-hosted (see public/draco, public/basis) rather than
 * pulled from a CDN, so an embedded widget never depends on third-party availability.
 */
export function configureGltfLoader(
  gl: WebGLRenderer,
  decoderPath = DECODER_PATHS.draco,
  ktx2Path = DECODER_PATHS.ktx2,
) {
  return (loader: GLTFLoader) => {
    loader.setDRACOLoader(getDracoLoader(decoderPath));
    const ktx2 = getKtx2Loader(ktx2Path);
    ktx2.detectSupport(gl);
    loader.setKTX2Loader(ktx2);
    loader.setMeshoptDecoder(MeshoptDecoder());
  };
}
