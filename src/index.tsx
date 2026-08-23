import React from 'react';
import ReactDOM from 'react-dom/client';
import { Provider } from 'react-redux';
import { FluentProvider, webLightTheme } from '@fluentui/react-components';
import App from './App';
import { store } from './store';
import './index.css';

const root = ReactDOM.createRoot(document.getElementById('root') as HTMLElement);

root.render(
  <React.StrictMode>
    <Provider store={store}>
      <FluentProvider theme={webLightTheme}>
        <App />
      </FluentProvider>
    </Provider>
  </React.StrictMode>
);