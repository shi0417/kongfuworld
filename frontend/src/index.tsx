import React from 'react';
import ReactDOM from 'react-dom/client';
import './styles/theme.css';
import './index.css';
import App from './App';
import * as serviceWorkerRegistration from './serviceWorkerRegistration';
import reportWebVitals from './reportWebVitals';

const root = ReactDOM.createRoot(
  document.getElementById('root') as HTMLElement
);
// 暂时移除 StrictMode 以消除第三方库（react-facebook-login, react-apple-signin-auth）的警告
// 这些库使用了已废弃的 componentWillReceiveProps 生命周期方法
// TODO: 当这些库更新后，可以重新启用 StrictMode
root.render(
  <App />
);

// If you want your app to work offline and load faster, you can change
// unregister() to register() below. Note this comes with some pitfalls.
// Learn more about service workers: https://cra.link/PWA
serviceWorkerRegistration.unregister();

// If you want to start measuring performance in your app, pass a function
// to log results (for example: reportWebVitals(console.log))
// or send to an analytics endpoint. Learn more: https://bit.ly/CRA-vitals
reportWebVitals();
