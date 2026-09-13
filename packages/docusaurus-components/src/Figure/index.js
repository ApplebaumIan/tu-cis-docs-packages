import React from 'react';

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
  return (
    <figure id={id ?? captionId(caption)} style={{textAlign: align, ...style}}>
      {children}
      {src ? <img src={src} alt={alt} /> : null}
      {caption ? <figcaption style={{fontWeight: 'bold'}}>{caption}</figcaption> : null}
      {subcaption ? <figcaption>{subcaption}</figcaption> : null}
    </figure>
  );
}
