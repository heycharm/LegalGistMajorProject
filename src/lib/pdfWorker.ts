// src/utils/setupPdfWorker.ts
import * as pdfjsLib from 'pdfjs-dist';
// import * as pdfjsLib from '/';
// import yoyo from '.../../pdfjs-dist/build/pdf.worker.min.js';

// Set the worker source to use local worker file with correct URL format
pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
  '/pdf.worker.min.mjs',
  window.location.origin
).toString();

export default pdfjsLib;

