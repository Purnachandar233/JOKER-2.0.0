// Basic sanitizer to mask tokens, connection strings, emails and secrets
function sanitize(input) {
  if (!input && input !== 0) return '';
  let text = '';
  try {
    text = typeof input === 'string' ? input : JSON.stringify(input, null, 2);
  } catch (err) {
    console.error('sanitize: JSON.stringify failed', err && (err.message || err));
    return '[COULD_NOT_SANITIZE]';
  }

  // Mask Discord token patterns (common format)
  try {
    text = text.replace(/([A-Za-z0-9_\-]{24}\.[A-Za-z0-9_\-]{6}\.[A-Za-z0-9_\-]{27})/g, '[REDACTED_TOKEN]');
  } catch (e) {
    console.error('sanitize: token masking failed', e && (e.message || e));
  }

  // Mask generic-looking JWTs / long base64 strings
  text = text.replace(/([A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,})/g, '[REDACTED_TOKEN]');

  // Mask MongoDB URIs with credentials
  text = text.replace(/(mongodb(?:\+srv)?:\/\/)([^@\s]+)@/g, '$1[REDACTED_CREDENTIALS]@');

  // Mask common secret query params (password=, pwd=, token=, key=)
  text = text.replace(/(password|pwd|token|key)=([^&\s]+)/gi, '$1=[REDACTED]');

  // Mask emails
  text = text.replace(/([a-zA-Z0-9._%+-]+)@([a-zA-Z0-9.-]+)\.([a-zA-Z]{2,})/g, '[REDACTED_EMAIL]');

  // Mask long hex/keys
  text = text.replace(/\b([A-Fa-f0-9]{32,})\b/g, '[REDACTED_KEY]');

  return text;
}

module.exports = sanitize;
