/// <reference types="@testing-library/jest-dom" />

declare module "*.svg" {
    const content: any;
    export default content;
  }

declare module '*.module.css';

declare namespace JSX {
  interface IntrinsicElements {
    marquee: any;
  }
}