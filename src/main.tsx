import React from 'react';
import ReactDOM from 'react-dom/client';
import { ConfigProvider } from 'antd';
import App from './App';
import './styles.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ConfigProvider
      theme={{
        token: {
          colorPrimary: '#061178',
          colorInfo: '#061178',
          colorText: '#1d2433',
          colorTextSecondary: '#70798a',
          colorBorder: '#e5e8ef',
          colorBgLayout: '#f5f6f9',
          borderRadius: 6,
          fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", sans-serif',
          fontSize: 13,
        },
        components: {
          Button: { primaryShadow: 'none' },
          Table: { headerBg: '#f7f8fa', cellPaddingBlock: 11, cellPaddingInline: 12 },
          Menu: { itemBorderRadius: 5 },
        },
      }}
    >
      <App />
    </ConfigProvider>
  </React.StrictMode>,
);
