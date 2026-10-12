// React — install once, then use the same names as Android.
import { createRoot } from 'react-dom/client';
import { cssDimen, install, sdp, ssp, scaledDp, UiModeType, DpQualifier } from 'webdimens';
import { useDimens, useDimen } from 'webdimens/react';

install();

const gutter = scaledDp(16).screen(UiModeType.TELEVISION, 40).screen(DpQualifier.SMALL_WIDTH, 600, 24);

function Card({ title }: { title: string }) {
  useDimens(); // re-render on viewport changes (only needed for JS-computed values)
  return (
    <section style={{ padding: sdp(16), borderRadius: sdp(12), marginBottom: gutter.sdp }}>
      <h2 style={{ fontSize: ssp(20) }}>{title}</h2>
      {/* SSR-friendly: CSS tokens, no re-render needed */}
      <p style={{ fontSize: cssDimen('ssp', 14) }}>Scales like 14.ssp on Android.</p>
    </section>
  );
}

function Avatar({ size }: { size: number }) {
  const px = useDimen(() => sdp(size), [size]);
  return <img width={px} height={px} alt="" src="/avatar.png" />;
}

createRoot(document.getElementById('root')!).render(<><Card title="Hello" /><Avatar size={48} /></>);
