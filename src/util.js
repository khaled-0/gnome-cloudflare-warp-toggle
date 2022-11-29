const Main = imports.ui.main

const errors = new Map()

/**
 * Send an error alert
 * @param {string} id The identifier for message
 * @param {string} message The message for notification
 */
// eslint-disable-next-line no-unused-vars
function setError(id, message) {
  if (errors.has(id)) return

  errors.set(id, true)

  Main.notify('Cloudflare WARP is not working', message)
}

/**
 * Clear an error alert
 * @param {*} id The identifier for the alert
 */
// eslint-disable-next-line no-unused-vars
function clearError(id) {
  errors.delete(id)
}
