// Build a redirect URL carrying a message shown by the layout
const withMessage = (url, type, message) =>
  `${url}${url.includes('?') ? '&' : '?'}${type}=${encodeURIComponent(message)}`;

module.exports = {
  withError: (url, message) => withMessage(url, 'error', message),
  withSuccess: (url, message) => withMessage(url, 'success', message)
};
