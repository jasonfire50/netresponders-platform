/**
 * A collection of utility functions used across the application.
 */

/**
 * Calculates whether text on a given background color should be black or white
 * for the best contrast.
 * @param {string} hexcolor The hex color string (e.g., "#ffc107").
 * @return {string} "black" or "white".
 */

function getContrastYIQ(hexcolor) {
  if (!hexcolor) return "white";
  let hex = hexcolor.replace("#", "");
  if (hex.length === 3) {
    hex = hex.split("").map((char) => char + char).join("");
  }
  if (hex.length !== 6) {
    console.warn("getContrastYIQ: Invalid color:", hexcolor);
    return "white";
  }
  const r = parseInt(hex.substr(0, 2), 16);
  const g = parseInt(hex.substr(2, 2), 16);
  const b = parseInt(hex.substr(4, 2), 16);
  if (isNaN(r) || isNaN(g) || isNaN(b)) {
    console.warn("getContrastYIQ: Parse fail:", hexcolor);
    return "white";
  }
  const yiq = ((r * 299) + (g * 587) + (b * 114)) / 1000;
  return (yiq >= 128) ? "black" : "white";
}

// We can add other global helpers here in the future, like showLoader/hideLoader