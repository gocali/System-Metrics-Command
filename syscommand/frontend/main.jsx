import React from 'react'
import { createRoot } from 'react-dom/client'
import SysMonitorUI from './SysCommand.jsx'

const container = document.getElementById('root')
const root = createRoot(container)
root.render(
  <React.StrictMode>
    <SysMonitorUI />
  </React.StrictMode>
)
