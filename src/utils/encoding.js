export const utf8_to_b64 = (str) => window.btoa(unescape(encodeURIComponent(str)));
export const b64_to_utf8 = (str) => decodeURIComponent(escape(window.atob(str)));
