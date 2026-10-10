// SPDX-License-Identifier: MIT
// Show a short status text. type is ok, bad or wait.
export function show(element, text, type) {
  element.textContent = text;
  element.className = type;
}
