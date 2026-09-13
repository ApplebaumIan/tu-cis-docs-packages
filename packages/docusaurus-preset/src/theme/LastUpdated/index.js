import React from 'react';
import LastUpdated from '@docusaurus/theme-classic/lib/theme/LastUpdated';
import RevisionHistory from '../../components/RevisionHistory';

export default function LastUpdatedWrapper(props) {
    return (
        <>
            {process.env.NODE_ENV === 'production' ? <RevisionHistory /> : null}
            <LastUpdated {...props} />
        </>
    );
}
