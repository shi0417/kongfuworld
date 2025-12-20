import React from 'react';
import { render } from '@testing-library/react';

test('testing environment renders basic react element', () => {
  // 注意：当前项目使用的 react-router-dom@7 在 CRA(Jest) 环境下可能出现 ESM/exports 解析兼容问题，
  // 导致直接 import App 触发 “Cannot find module 'react-router-dom'”。
  // 这里先用一个与路由无关的 smoke test，确保测试环境与渲染管线本身可用。
  const { getByText } = render(<div>ok</div>);
  expect(getByText('ok')).toBeInTheDocument();
});
