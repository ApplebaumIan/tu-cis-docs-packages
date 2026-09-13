import React from "react";
import useBaseUrl from '@docusaurus/useBaseUrl';

/**
 * Displays generated HTML docs in an iframe.
 *
 * @param {{
 *   docFolder: string,
 *   width?: string,
 *   height?: string
 * }} props
 */
function InlineDocs({docFolder, width = '100%', height = '600px', title}) {
	const iframeSrc = useBaseUrl(`/${docFolder.replace(/^\/+|\/+$/g, '')}/index.html`);

	return (
		<div style={{ margin: "1em 0" }}>
			<a
				href={iframeSrc}
				target="_blank"
				rel="noreferrer"
				style={{ display: "inline-block", marginBottom: "0.5em" }}
			>
				Click me for Full Screen
			</a>
			<iframe
				src={iframeSrc}
				width={width}
				height={height}
				title={title ?? docFolder}
				style={{
					border: "2px solid #ddd",
					borderRadius: "8px",
					boxShadow: "0 0 6px rgba(0,0,0,0.1)",
				}}
			/>
		</div>
	);
}

export default InlineDocs;
