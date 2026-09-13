import React, {useState} from 'react';
import styles from './styles.module.css';
import useDocusaurusContext from '@docusaurus/useDocusaurusContext';
import useBaseUrl from '@docusaurus/useBaseUrl';

export default function Contributors({orgName, projectName: projectNameProp}) {
  const {siteConfig} = useDocusaurusContext();
  const fallbackHref = useBaseUrl('/tutorial/tutorial-basics/set-environment-variables');
  const [imageError, setImageError] = useState(false);
  const organizationName = orgName || siteConfig.organizationName;
  const projectName = projectNameProp || siteConfig.projectName;
  const hasRepository = Boolean(organizationName && projectName);
  const contributorsImageSrc = imageError || !hasRepository
    ? 'https://via.placeholder.com/400x100/f0f0f0/666666?text=Contributors+Not+Available'
    : `https://contrib.rocks/image?repo=${organizationName}/${projectName}`;
  const linkHref = imageError || !hasRepository
    ? fallbackHref
    : `https://github.com/${organizationName}/${projectName}/graphs/contributors`;

  return (
    <div className={styles.contributors}>
      <a href={linkHref}>
        <img
          src={contributorsImageSrc}
          alt={imageError || !hasRepository
            ? 'Contributors unavailable. Learn how to configure repository details.'
            : 'Project contributors'}
          onError={() => setImageError(true)}
        />
      </a>
      <p>Made with <a href="https://contrib.rocks">contrib.rocks</a>.</p>
    </div>
  );
}
