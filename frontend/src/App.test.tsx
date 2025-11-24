import React from 'react';
import { render } from '@testing-library/react';
import App from './App';

test('renders app', () => {
  const { container } = render(<App />);
  // 基本测试，确保应用能正常渲染
  expect(container).toBeTruthy();
});
