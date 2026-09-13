import React from 'react';
import {Contributors, Figure, InlineDocs} from '@tu-cis-courses/docusaurus-components';
const dinosaur = 'https://www.docusaurus.io/img/docusaurus.png';
// Add react-live imports you need here
const ReactLiveScope = {
  React,
  ...React,
  Figure,
  InlineDocs,
  Contributors,
  dinosaur,

};
export default ReactLiveScope;
