import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'

// Leaflet CSS — MUST be imported before any react-leaflet components
import 'leaflet/dist/leaflet.css'

// Fix Leaflet default icon bug (Vite doesn't resolve marker PNGs automatically)
import L from 'leaflet'
delete L.Icon.Default.prototype._getIconUrl
L.Icon.Default.mergeOptions({
  iconRetinaUrl: new URL('leaflet/dist/images/marker-icon-2x.png', import.meta.url).href,
  iconUrl: new URL('leaflet/dist/images/marker-icon.png', import.meta.url).href,
  shadowUrl: new URL('leaflet/dist/images/marker-shadow.png', import.meta.url).href,
})

import App from './App.jsx'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
