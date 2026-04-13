import { createPortal } from 'react-dom'

/**
 * Renders children directly into document.body via React Portal.
 * This guarantees position:fixed children (modal backdrops) are
 * positioned relative to the true viewport — not any transformed
 * or overflow ancestor inside the app layout.
 */
export default function ModalPortal({ children }) {
  return createPortal(children, document.body)
}
