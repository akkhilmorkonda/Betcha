import { Composition, registerRoot } from 'remotion';
import { BetchaPromo } from './compositions/BetchaPromo';
import './styles.css';

const RemotionRoot = () => {
  return (
    <>
      <Composition
        id="BetchaPromo"
        component={BetchaPromo}
        durationInFrames={1620}
        fps={30}
        width={1280}
        height={720}
      />
    </>
  );
};

registerRoot(RemotionRoot);
