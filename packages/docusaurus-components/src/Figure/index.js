import React, {useCallback} from 'react';
import ZoomableMedia from '../ZoomableMedia';

function captionId(caption) {
  return typeof caption === 'string'
    ? caption.replaceAll('.', '-').replace(/\s+/g, '-').toLowerCase()
    : undefined;
}

export default function Figure({
  align = 'center',
  alt = '',
  caption,
  children,
  id,
  src,
  style = {},
  subcaption,
}) {
  const getFullscreenContent = useCallback(() => (
    src ? <img src={src} alt={alt} draggable="false" /> : null
  ), [alt, src]);

  return (
    <figure id={id ?? captionId(caption)} style={{textAlign: align, ...style}}>
      {children}
      {src ? (
        <ZoomableMedia
          actionsLabel="Image actions"
          closeLabel="Close fullscreen image"
          getFullscreenContent={getFullscreenContent}
          isReady
          openLabel="Open image fullscreen"
          transformLabel="Pan and zoom image"
          variant="image"
        >
          <img src={src} alt={alt} />
        </ZoomableMedia>
      ) : null}
      {caption ? <figcaption style={{fontWeight: 'bold'}}>{caption}</figcaption> : null}
      {subcaption ? <figcaption>{subcaption}</figcaption> : null}
    </figure>
  );
}
