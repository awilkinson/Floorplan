import { Bloom, EffectComposer, N8AO, SMAA, ToneMapping, Vignette } from '@react-three/postprocessing';
import { ToneMappingMode } from 'postprocessing';

export function Effects({ quality, evening }: { quality: 'high' | 'balanced'; evening: boolean }) {
  const high = quality === 'high';
  return (
    <EffectComposer multisampling={high ? 4 : 0} enableNormalPass={false}>
      <N8AO aoRadius={0.55} distanceFalloff={0.7} intensity={evening ? 1.6 : 2.4} quality={high ? 'medium' : 'performance'} halfRes={!high} color="#1a1410" />
      <Bloom mipmapBlur intensity={evening ? 0.55 : 0.22} luminanceThreshold={evening ? 0.75 : 0.95} luminanceSmoothing={0.25} />
      <ToneMapping mode={ToneMappingMode.AGX} />
      <Vignette eskil={false} offset={0.28} darkness={0.32} />
      {high ? <></> : <SMAA />}
    </EffectComposer>
  );
}
