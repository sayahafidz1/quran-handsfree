export const recognitionDebugEnabled =
  typeof import.meta.env !== "undefined" &&
  import.meta.env.DEV &&
  import.meta.env.VITE_DEBUG_RECOGNITION === "true";
