import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
//import App from './App.tsx'
import WrappedExampleComponent from './WrappedExampleComponent.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <WrappedExampleComponent />
  </StrictMode>,
)
